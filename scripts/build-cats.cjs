// Draw every Cat of the Day, in every Pose.
//
//   node scripts/build-cats.cjs [outDir] [--sheet <file>]
//
// Every path is resolved against the repository, not the working directory, so
// the script runs the same from anywhere. `outDir` defaults to `public/cats`,
// the drawings committed to the repo; pass one to render somewhere else and
// diff the result. `--sheet` additionally writes a magnified contact sheet of
// the whole set for eyeballing a palette change; it is never shipped.
//
// Two hand-drawn PNGs hold the same three poses — one plain, one with a belly
// marking. Every cat is one of those drawings with its colours swapped out,
// which is what keeps the whole set looking like one family.
//
// Everything adjustable lives in the tables below. Nothing further down needs
// editing to change how the cats look.

const fs = require("fs");
const path = require("path");
const { decode, encode, scale, crop, blobs } = require("./png.cjs");

const REPO = path.join(__dirname, "..");
const ART = path.join(REPO, "art");

const args = process.argv.slice(2);
const positional = [];
let sheet = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--sheet") {
    sheet = args[++i];
    if (!sheet || sheet.startsWith("-")) throw new Error("--sheet needs a file path");
  } else if (args[i].startsWith("-")) {
    // Otherwise a typo becomes the output directory and the drawings land in
    // one named "--shet".
    throw new Error(`unknown option "${args[i]}"`);
  } else {
    positional.push(args[i]);
  }
}
if (positional.length > 1)
  throw new Error(`expected at most one output directory, got ${positional.length}`);
const OUT = path.resolve(positional[0] || path.join(REPO, "public", "cats"));
const SHEET = sheet === null ? null : path.resolve(sheet);

// ---------------------------------------------------------------------------
// SOURCE DRAWINGS
// ---------------------------------------------------------------------------

const SOURCES = {
  plain: path.join(ART, "cat-poses-plain.png"),
  belly: path.join(ART, "cat-poses-belly.png"),
};

// The colours used in those drawings. Change these only if the art is redrawn
// with a different palette — they are what the recolouring matches against.
const SOURCE_COLOURS = {
  fur: [250, 161, 52],          // main body          -> replaced per cat
  shade: [255, 126, 0],         // rim shading        -> replaced per cat
  bellyLight: [255, 249, 189],  // belly, lit         -> replaced per cat
  bellyDark: [245, 228, 156],   // belly, shaded edge -> replaced per cat
  outline: [0, 0, 0],           // left untouched on every cat
  blush: [255, 163, 177],       // left untouched on every cat
};

// ---------------------------------------------------------------------------
// COLOURS
// ---------------------------------------------------------------------------

// Fur pairs. `inverted` reuses the same pair the other way round, so the rim
// colour becomes the body and the body colour becomes the rim.
const BASES = {
  ginger:   { fur: [250, 161, 52],  shade: [255, 126, 0] },   // as drawn
  grey:     { fur: [170, 170, 178], shade: [122, 122, 134] },
  charcoal: { fur: [108, 106, 118], shade: [74, 72, 84] },
  sand:     { fur: [222, 198, 156], shade: [182, 152, 106] },
  brown:    { fur: [168, 118, 74],  shade: [126, 84, 48] },
  rust:     { fur: [220, 104, 66],  shade: [178, 68, 40] },
};

// Belly markings a cat can wear. Two tones each: `light` is the lit face of
// the patch, `dark` the shaded edge along its bottom.
const BELLIES = {
  cream: { light: [255, 249, 189], dark: [245, 228, 156] },  // as drawn
  white: { light: [252, 250, 246], dark: [228, 224, 216] },
};

// The cats, in order. The index is the id the app uses, so appending is safe
// and reordering is not. `belly` is null, "cream" or "white".
const CATS = [
  { base: "ginger",   inverted: false, belly: null },
  { base: "ginger",   inverted: true,  belly: "cream" },
  { base: "grey",     inverted: false, belly: "white" },
  { base: "grey",     inverted: true,  belly: null },
  { base: "charcoal", inverted: false, belly: "white" },
  { base: "charcoal", inverted: true,  belly: "cream" },
  { base: "sand",     inverted: false, belly: null },
  { base: "sand",     inverted: true,  belly: "white" },
  { base: "brown",    inverted: false, belly: "cream" },
  { base: "brown",    inverted: true,  belly: null },
  { base: "rust",     inverted: false, belly: null },
  { base: "rust",     inverted: true,  belly: "white" },
];

// ---------------------------------------------------------------------------
// THE POSE BOX
// ---------------------------------------------------------------------------

// Every Pose is drawn into a box this size, so a Cat holds still on the page
// as its Goal changes state rather than jumping about.
const POSE_W = 28;
const POSE_H = 24;

const POSES = ["asleep", "alert", "sitting"];
// Left to right in the source drawings.
const SOURCE_ORDER = ["sitting", "alert", "asleep"];

// ---------------------------------------------------------------------------

const key = (c) => `${c[0]},${c[1]},${c[2]}`;
const K_FUR = key(SOURCE_COLOURS.fur);
const K_SHADE = key(SOURCE_COLOURS.shade);
const K_BELLY_LIGHT = key(SOURCE_COLOURS.bellyLight);
const K_BELLY_DARK = key(SOURCE_COLOURS.bellyDark);

// Lift each Pose out of a drawing into the shared box: centred horizontally,
// bottom-aligned so every Pose stands on one baseline.
function loadPoses(file) {
  const img = decode(fs.readFileSync(file));
  const found = blobs(img).sort((a, b) => a.x - b.x);
  // Anything that does not touch a cat is its own blob, so a mark left in the
  // margin — or a detail drawn a pixel clear of the body it belongs to — shows
  // up here as a fourth pose rather than disappearing. Listing every blob with
  // its size says which one is the stray.
  if (found.length !== 3)
    throw new Error(
      `expected 3 poses in ${path.basename(file)}, found ${found.length}: ` +
        found.map((b) => `${b.w}x${b.h} at ${b.x},${b.y} (${b.n}px)`).join("; ") +
        ". Anything detached from a cat counts as a pose of its own; join it " +
        "to the cat it belongs to, or take it out of the drawing.",
    );

  const out = {};
  found.forEach((box, i) => {
    if (box.w > POSE_W || box.h > POSE_H)
      throw new Error(
        `the ${SOURCE_ORDER[i]} pose in ${path.basename(file)} is ${box.w}x${box.h}, ` +
          `which does not fit the ${POSE_W}x${POSE_H} box`,
      );

    const pose = crop(img, box.x, box.y, box.w, box.h);
    const data = Buffer.alloc(POSE_W * POSE_H * 4);
    const dx = Math.floor((POSE_W - box.w) / 2);
    const dy = POSE_H - box.h;
    for (let y = 0; y < box.h; y++)
      for (let x = 0; x < box.w; x++) {
        const s = (y * box.w + x) * 4;
        pose.data.copy(data, ((y + dy) * POSE_W + (x + dx)) * 4, s, s + 4);
      }
    out[SOURCE_ORDER[i]] = { width: POSE_W, height: POSE_H, data };
  });
  return out;
}

const DRAWN = {
  plain: loadPoses(SOURCES.plain),
  belly: loadPoses(SOURCES.belly),
};

function render(cat, pose) {
  const base = BASES[cat.base];
  if (!base) throw new Error(`unknown base "${cat.base}"`);
  if (cat.belly && !BELLIES[cat.belly]) throw new Error(`unknown belly "${cat.belly}"`);

  const drawn = DRAWN[cat.belly ? "belly" : "plain"][pose];
  const fur = cat.inverted ? base.shade : base.fur;
  const shade = cat.inverted ? base.fur : base.shade;
  const belly = cat.belly ? BELLIES[cat.belly] : null;

  const data = Buffer.from(drawn.data);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const k = key([data[i], data[i + 1], data[i + 2]]);
    const to =
      k === K_FUR ? fur
      : k === K_SHADE ? shade
      : k === K_BELLY_LIGHT ? belly && belly.light
      : k === K_BELLY_DARK ? belly && belly.dark
      : null;
    if (to) { data[i] = to[0]; data[i + 1] = to[1]; data[i + 2] = to[2]; }
  }
  return { width: POSE_W, height: POSE_H, data };
}

const label = (c) =>
  [c.base, c.inverted ? "inverted" : null, c.belly].filter(Boolean).join("-");

fs.mkdirSync(OUT, { recursive: true });
CATS.forEach((cat, id) => {
  for (const pose of POSES)
    fs.writeFileSync(path.join(OUT, `${id}-${pose}.png`), encode(render(cat, pose)));
});
fs.writeFileSync(
  path.join(OUT, "cats.json"),
  JSON.stringify({ size: [POSE_W, POSE_H], poses: POSES, cats: CATS.map(label) }, null, 2) + "\n",
);

// Contact sheet: the whole set at once, magnified, for eyeballing a palette
// change. Written only when asked for, and never shipped.
if (SHEET !== null) {
  const GAP = 2;
  const sheetW = POSES.length * (POSE_W + GAP) + GAP;
  const sheetH = CATS.length * (POSE_H + GAP) + GAP;
  const pixels = Buffer.alloc(sheetW * sheetH * 4);
  CATS.forEach((cat, r) =>
    POSES.forEach((pose, c) => {
      const f = render(cat, pose);
      const ox = GAP + c * (POSE_W + GAP);
      const oy = GAP + r * (POSE_H + GAP);
      for (let y = 0; y < POSE_H; y++)
        for (let x = 0; x < POSE_W; x++) {
          const s = (y * POSE_W + x) * 4;
          f.data.copy(pixels, ((oy + y) * sheetW + (ox + x)) * 4, s, s + 4);
        }
    }),
  );
  fs.mkdirSync(path.dirname(SHEET), { recursive: true });
  fs.writeFileSync(SHEET, encode(scale({ width: sheetW, height: sheetH, data: pixels }, 6)));
  console.log(`contact sheet -> ${SHEET}`);
}

console.log(
  `${CATS.length} cats x ${POSES.length} poses = ` +
    `${CATS.length * POSES.length} drawings -> ${OUT}`,
);
CATS.forEach((c, i) => console.log(`  ${String(i).padStart(2, "0")}  ${label(c)}`));
