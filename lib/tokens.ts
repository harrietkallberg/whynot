import { createHash, randomBytes } from "node:crypto";

/**
 * Possession of a link is the only identity in this system (ADR-0002), so a
 * token is a credential: it is minted here, hashed here, and never logged,
 * reported or handed to analytics anywhere.
 */

/** Bitcoin base58: no 0, O, I or l, so a token survives being read aloud. */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** 128 bits of randomness. */
const TOKEN_BYTES = 16;

/**
 * Every token is this wide. Base58 is a change of base, not a block encoding,
 * so a draw that happens to be a small number encodes short — a 1-in-2000 draw
 * comes out at 20 characters or fewer, and once in a very long while at one.
 * Left-padding with the zero digit fixes the width without touching the 128
 * bits behind it, exactly as a leading zero byte is already spelled out.
 */
const TOKEN_LENGTH = 22;

function encodeBase58(bytes: Buffer): string {
  let remaining = 0n;
  for (const byte of bytes) remaining = (remaining << 8n) | BigInt(byte);

  let encoded = "";
  while (remaining > 0n) {
    encoded = ALPHABET[Number(remaining % 58n)] + encoded;
    remaining /= 58n;
  }

  return encoded.padStart(TOKEN_LENGTH, ALPHABET[0]);
}

/**
 * A fresh 128-bit token, for an Owner Link or a Response Link: always
 * TOKEN_LENGTH base58 characters.
 *
 * The bytes can be supplied so the width is testable at the values a random
 * draw reaches too rarely to rely on.
 */
export function mintToken(bytes: Buffer = randomBytes(TOKEN_BYTES)): string {
  if (bytes.length !== TOKEN_BYTES) {
    throw new Error(`A token is ${TOKEN_BYTES} bytes, not ${bytes.length}.`);
  }

  return encodeBase58(bytes);
}

/**
 * The stored form of an Owner Link token. A leak of the table must not hand
 * over every Dashboard, and a 128-bit random token has nothing to guess back,
 * so a plain digest is the right tool here — this is not a password.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
