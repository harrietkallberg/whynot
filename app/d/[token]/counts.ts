/**
 * How many Responses a Goal has had, in words. Both Owner pages say it the
 * same way, because it is the only number either of them shows: a count is
 * all an Owner ever gets about arrivals, never a time (ADR-0003).
 *
 * It counts Responses and not people. Nothing stops one person sending more
 * than one, so the wording never implies otherwise.
 */
export function countOfResponses(responseCount: number): string {
  if (responseCount === 0) return "No Responses yet";
  if (responseCount === 1) return "1 Response";
  return `${responseCount} Responses`;
}
