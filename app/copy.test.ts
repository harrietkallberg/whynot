import { describe, expect, it } from "vitest";

import { LANDING_LINE } from "./copy";

describe("the landing line", () => {
  it("is one sentence", () => {
    expect(LANDING_LINE).toMatch(/^[^.!?]+[.!?]$/);
  });

  it("says the answers are collected anonymously", () => {
    expect(LANDING_LINE).toMatch(/anonymously/);
  });

  it("promises the Owner only what the answers have in common", () => {
    // An Owner is shown Reports and never a Response (ADR-0003).
    expect(LANDING_LINE).toMatch(/only what their answers have in common/);
  });
});
