/**
 * The Cat of the Day: the one pixel-art cat everybody sees on a given calendar
 * day. A Goal freezes the Cat it was created under and keeps it forever, and
 * the Dashboard renders that Cat's Poses, so the choosing rule lives here and
 * nowhere else.
 */

/** How many Cats exist. Shipping with one; the rule already handles more. */
export const CAT_COUNT = 1;

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
 */
export function catOfTheDay(date: Date, catCount: number = CAT_COUNT): number {
  return dayOfYear(date) % catCount;
}
