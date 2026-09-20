import { describe, expect, it } from "vitest";

import { CAT_COUNT, catOfTheDay } from "./cats";

describe("catOfTheDay", () => {
  it("shows one Cat to everybody on a given calendar day", () => {
    const morning = catOfTheDay(new Date("2025-06-15T00:00:00Z"));
    const evening = catOfTheDay(new Date("2025-06-15T23:59:59Z"));

    expect(evening).toBe(morning);
  });

  it("walks the set by day of year and wraps at the end of it", () => {
    // 1 March 2025 is the 60th day of that year; 1 March 2024 is the 61st,
    // because 2024 is a leap year; 31 December 2025 is the 365th.
    expect(catOfTheDay(new Date("2025-03-01T12:00:00Z"), 7)).toBe(60 % 7);
    expect(catOfTheDay(new Date("2024-03-01T12:00:00Z"), 7)).toBe(61 % 7);
    expect(catOfTheDay(new Date("2025-12-31T12:00:00Z"), 7)).toBe(365 % 7);
  });

  it("ships with a single Cat, so every day freezes that same Cat", () => {
    expect(CAT_COUNT).toBe(1);

    for (const day of ["2025-01-01", "2025-07-04", "2026-02-28"]) {
      expect(catOfTheDay(new Date(`${day}T09:00:00Z`))).toBe(0);
    }
  });
});
