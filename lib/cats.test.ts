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

  it("draws on the twelve Cats that have been drawn", () => {
    expect(CAT_COUNT).toBe(12);
  });

  it("hands out the next Cat each day and starts the set over after the last", () => {
    // 11, 12 and 13 January are the 11th, 12th and 13th days of 2025, so with
    // twelve Cats the 12th is where the set runs out and begins again.
    expect(catOfTheDay(new Date("2025-01-11T12:00:00Z"))).toBe(11);
    expect(catOfTheDay(new Date("2025-01-12T12:00:00Z"))).toBe(0);
    expect(catOfTheDay(new Date("2025-01-13T12:00:00Z"))).toBe(1);
  });

  it("counts from the first of January, so a new year restarts the walk", () => {
    // Day of year, not a running tally: 2025 ends on its 365th day and 2024,
    // a leap year, on its 366th, but both are followed by a 1st of January,
    // which is day one and so always the second Cat of the set.
    expect(catOfTheDay(new Date("2025-12-31T12:00:00Z"))).toBe(5); // 365 = 30 × 12 + 5
    expect(catOfTheDay(new Date("2026-01-01T12:00:00Z"))).toBe(1);

    expect(catOfTheDay(new Date("2024-12-31T12:00:00Z"))).toBe(6); // 366 = 30 × 12 + 6
    expect(catOfTheDay(new Date("2025-01-01T12:00:00Z"))).toBe(1);
  });

  it("only ever names a Cat that has been drawn, and names each of them", () => {
    // Every answer is an index into `public/cats`, so a day that fell outside
    // the set would leave the Dashboard asking for a Cat nobody drew.
    const seen = new Set<number>();
    const day = new Date("2024-01-01T12:00:00Z"); // a leap year: 366 days

    while (day.getUTCFullYear() === 2024) {
      const id = catOfTheDay(day);

      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(CAT_COUNT);
      seen.add(id);

      day.setUTCDate(day.getUTCDate() + 1);
    }

    expect([...seen].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });
});
