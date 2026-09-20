import { createHash, randomBytes } from "node:crypto";

/**
 * Possession of a link is the only identity in this system (ADR-0002), so a
 * token is a credential: it is minted here, hashed here, and never logged,
 * reported or handed to analytics anywhere.
 */

/** Bitcoin base58: no 0, O, I or l, so a token survives being read aloud. */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** 128 bits of randomness, which base58 renders in 21-22 characters. */
const TOKEN_BYTES = 16;

function encodeBase58(bytes: Buffer): string {
  let remaining = 0n;
  for (const byte of bytes) remaining = (remaining << 8n) | BigInt(byte);

  let encoded = "";
  while (remaining > 0n) {
    encoded = ALPHABET[Number(remaining % 58n)] + encoded;
    remaining /= 58n;
  }

  // A leading zero byte carries no value but is still a byte, so base58 spells
  // each one out as the zero digit.
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = ALPHABET[0] + encoded;
  }

  return encoded === "" ? ALPHABET[0] : encoded;
}

/** A fresh 128-bit token, for an Owner Link or a Response Link. */
export function mintToken(): string {
  return encodeBase58(randomBytes(TOKEN_BYTES));
}

/**
 * The stored form of an Owner Link token. A leak of the table must not hand
 * over every Dashboard, and a 128-bit random token has nothing to guess back,
 * so a plain digest is the right tool here — this is not a password.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
