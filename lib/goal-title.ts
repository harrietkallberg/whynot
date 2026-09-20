/**
 * What counts as a name for a Goal. Kept apart from lib/goals.ts so the create
 * form can share the limit without pulling the database into the browser.
 *
 * A Goal is a single line of text, and that line is shown to everyone who opens
 * its Response Link, so it stays short enough to read at a glance.
 */
export const MAX_TITLE_LENGTH = 140;

/** Thrown when the one thing a Goal needs — a name — is unusable. */
export class InvalidGoalTitleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGoalTitleError";
  }
}

export function normaliseTitle(title: string): string {
  const normalised = title.replace(/\s+/g, " ").trim();

  if (normalised === "") {
    throw new InvalidGoalTitleError("A Goal needs a name.");
  }
  if (normalised.length > MAX_TITLE_LENGTH) {
    throw new InvalidGoalTitleError(
      `A Goal's name has to fit in ${MAX_TITLE_LENGTH} characters.`,
    );
  }

  return normalised;
}
