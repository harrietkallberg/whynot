import { describe, expect, it } from "vitest";

import { LANDING_LINE } from "./copy";

describe("the landing line", () => {
  it("is one sentence", () => {
    expect(LANDING_LINE).toMatch(/^[^.!?]+[.!?]$/);
  });

  it("says the answers are collected anonymously", () => {
    expect(LANDING_LINE).toMatch(/anonymously/);
  });
});
