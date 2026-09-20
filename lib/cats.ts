/**
 * The Cat of the Day: the one pixel-art cat everybody sees on a given calendar
 * day. A Goal freezes the Cat it was created under and keeps it forever, and
 * the Dashboard renders that Cat's Poses, so the choosing rule lives here and
 * nowhere else.
 */

/**
 * How many Cats exist. One per sprite set under `public/cats`, which
 * `scripts/build-cats.cjs` renders; raise this only alongside that script's
 * table of Cats.
 */
export const CAT_COUNT = 12;

/** The number of days since the start of the year in UTC, with 1 January = 1. */
function dayOfYear(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const startOfDay = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return (startOfDay - startOfYear) / millisecondsPerDay + 1;
}

/**
 * The Cat for a calendar day, as an index into the set of Cats. The date is
 * read in UTC so every visitor sees the same Cat at the same moment whatever
 * their clock says.
 *
 * The size of the set is a parameter because with one Cat the rule is
 * invisible: every date answers 0, and the wrap at the end of the set could
 * break unnoticed until the day a second Cat is drawn.
 */
export function catOfTheDay(date: Date, catCount: number = CAT_COUNT): number {
  return dayOfYear(date) % catCount;
}
