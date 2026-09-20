/**
 * The two sentences a Respondent is owed, kept in one place because both the
 * page and the form say them and neither may drift.
 */

/**
 * The promise. It has to stay true as written: a Report summarises a whole
 * Window and never quotes or attributes, and raw Response text is shown to the
 * Owner never, through no view and no API (ADR-0001, ADR-0003). Weakening
 * either of those means rewriting this sentence first.
 */
export const ANONYMITY_PROMISE =
  "Your answer is combined with others into a summary. It is never shown on its own, and the person who sent you this link will never see what you wrote.";

/** What a closed Goal says instead of taking an answer. */
export const CLOSED_HEADLINE = "This one's closed — they got their yes.";
