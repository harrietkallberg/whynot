/**
 * The two sentences a Respondent is owed, kept in one place because both the
 * page and the form say them and neither may drift.
 */

/**
 * The promise. It has to stay true as written, and each claim in it rests on
 * something that holds today:
 *
 * - No summary until enough other answers: a Report is only written once a
 *   whole Window has filled, and no Window is smaller than three Responses
 *   (findOwedWindow in lib/reports.ts, MIN_WINDOW_SIZE in lib/goals.ts).
 * - An AI model writes it: Reports are generated from a prompt sent to
 *   REPORT_MODEL (lib/reports.ts), which is a third party (ADR-0005).
 * - Never shown on its own, never seen by the sender: raw Response text is
 *   shown to the Owner never, through no view and no API, and a Report never
 *   quotes or attributes (ADR-0001, ADR-0003).
 *
 * It says nothing about what the model provider does with the text, and must
 * not: Zero Data Retention is not on this project's plan, so any promise about
 * retention or training could not be kept (ADR-0005). Weakening any of the
 * above means rewriting this sentence first.
 */
export const ANONYMITY_PROMISE =
  "Your answer waits until enough other answers have come in, and then an AI model combines them all into one summary. Your answer is never shown on its own, and the person who sent you this link will never see what you wrote.";

/** What a closed Goal says instead of taking an answer. */
export const CLOSED_HEADLINE = "This one's closed — they got their yes.";
