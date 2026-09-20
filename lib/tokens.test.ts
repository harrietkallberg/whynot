import { describe, expect, it } from "vitest";

import { mintToken } from "./tokens";

/** Bitcoin base58, exactly as an Owner Link or Response Link is written. */
const TOKEN = /^[1-9A-HJ-NP-Za-km-z]{22}$/;

describe("mintToken", () => {
  /**
   * A random draw is the wrong instrument for this: the short encodings are
   * the small numbers, which come up roughly once in two thousand mints and
   * would otherwise turn the shape of a token into a flaky assertion. The
   * bytes are constructed instead, at both ends of the range.
   */
  it.each([
    ["the smallest draw", Buffer.alloc(16)],
    ["one", Buffer.concat([Buffer.alloc(15), Buffer.from([1])])],
    [
      "a value with leading zero bytes",
      Buffer.concat([Buffer.alloc(3), Buffer.alloc(13, 0xff)]),
    ],
    ["the largest draw", Buffer.alloc(16, 0xff)],
  ])("writes %s as a full-width token", (_name, bytes) => {
    expect(mintToken(bytes)).toMatch(TOKEN);
  });

  it("gives a different token each time it is asked", () => {
    expect(mintToken()).not.toBe(mintToken());
  });

  it("refuses anything that is not 128 bits", () => {
    expect(() => mintToken(Buffer.alloc(8))).toThrow();
  });
});
