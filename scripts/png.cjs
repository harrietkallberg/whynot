// Minimal PNG decode/encode for 8-bit RGBA, plus upscale and crop. No deps.
const zlib = require("zlib");

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// This reads the one shape the drawings are saved in and refuses everything
// else, loudly. The refusals matter more than they look: a re-export in
// another shape would otherwise decode to silent garbage and render twelve
// cats out of it.
function decode(buf) {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIGNATURE))
    throw new Error("not a PNG");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (buf[24] !== 8 || buf[25] !== 6) throw new Error("expected 8-bit RGBA");
  if (buf[28] !== 0) throw new Error("expected a non-interlaced PNG");

  const idat = [];
  let p = 8;
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    if (p + 12 + len > buf.length) throw new Error("truncated PNG chunk");
    const type = buf.toString("ascii", p + 4, p + 8);
    if (type === "IDAT") idat.push(buf.subarray(p + 8, p + 8 + len));
    if (type === "IEND") break;
    p += 12 + len;
  }
  if (idat.length === 0) throw new Error("PNG has no image data");
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length !== height * (width * 4 + 1))
    throw new Error("PNG image data is the wrong size");

  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[rp++];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v;
      switch (filter) {
        case 0: v = cur; break;
        case 1: v = cur + a; break;
        case 2: v = cur + b; break;
        case 3: v = cur + ((a + b) >> 1); break;
        case 4: {
          const pa = Math.abs(b - c), pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error("bad filter " + filter);
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  return { width, height, data: out };
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encode({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function scale(img, n) {
  const width = img.width * n, height = img.height * n;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const s = (Math.floor(y / n) * img.width + Math.floor(x / n)) * 4;
      img.data.copy(data, (y * width + x) * 4, s, s + 4);
    }
  return { width, height, data };
}

function crop(img, x0, y0, w, h) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = ((y0 + y) * img.width + (x0 + x)) * 4;
      img.data.copy(data, (y * w + x) * 4, s, s + 4);
    }
  return { width: w, height: h, data };
}

// Anything smaller than this is a stray pixel left over from drawing rather
// than a cat: too small to be a Pose, and ignoring it keeps one from splitting
// a drawing into four blobs instead of three.
const MIN_BLOB = 8;

// Bounding boxes of non-transparent blobs, found by flood fill.
function blobs(img) {
  const seen = new Uint8Array(img.width * img.height);
  const found = [];
  const at = (x, y) => img.data[(y * img.width + x) * 4 + 3] > 0;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const i = y * img.width + x;
      if (seen[i] || !at(x, y)) continue;
      let minX = x, maxX = x, minY = y, maxY = y, n = 0;
      const stack = [[x, y]];
      seen[i] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        n++;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= img.width || ny >= img.height) continue;
            const ni = ny * img.width + nx;
            if (seen[ni] || !at(nx, ny)) continue;
            seen[ni] = 1;
            stack.push([nx, ny]);
          }
      }
      if (n > MIN_BLOB)
        found.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, n });
    }
  return found;
}

module.exports = { decode, encode, scale, crop, blobs };
