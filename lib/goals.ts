import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/db";

import { catOfTheDay } from "./cats";
import { mintOwner, resolveOwner } from "./owner";
import { mintToken } from "./tokens";

export type CreateGoalInput = {
  title: string;
  /** An Owner Link token held by a returning browser, if there is one. */
  ownerToken?: string | null;
};

/**
 * A Goal is a single line of text, and that line is shown to everyone who
 * opens its Response Link, so it stays short enough to read at a glance.
 */
export const MAX_TITLE_LENGTH = 140;

/** Thrown when the one thing a Goal needs — a name — is unusable. */
export class InvalidGoalTitleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGoalTitleError";
  }
}

function normaliseTitle(title: string): string {
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

export type CreatedGoal = {
  goalId: string;
  title: string;
  catId: number;
  /** Shown once, never recoverable, never logged (ADR-0002). */
  ownerToken: string;
  responseToken: string;
};

/**
 * Creates a Goal, minting an Owner for it when the browser does not already
 * hold an Owner Link.
 */
export async function createGoal({
  title: rawTitle,
  ownerToken: existingOwnerToken,
}: CreateGoalInput): Promise<CreatedGoal> {
  const title = normaliseTitle(rawTitle);

  const existingOwner = await resolveOwner(existingOwnerToken);
  const owner = existingOwner
    ? { id: existingOwner.id, ownerToken: existingOwnerToken as string }
    : await mintOwner();

  const responseToken = mintToken();
  const catId = catOfTheDay(new Date());
  const [goal] = await db
    .insert(schema.goal)
    .values({ ownerId: owner.id, responseToken, title, catId })
    .returning({ id: schema.goal.id, title: schema.goal.title });

  return {
    goalId: goal.id,
    title: goal.title,
    catId,
    ownerToken: owner.ownerToken,
    responseToken,
  };
}

/**
 * Every Goal behind one Owner Link — the Dashboard's list. Newest first,
 * because a returning Owner is usually here about the Goal they just made.
 */
export async function findGoalsByOwnerToken(
  ownerToken: string,
): Promise<OwnedGoal[]> {
  const owner = await resolveOwner(ownerToken);
  if (!owner) return [];

  return db
    .select({
      id: schema.goal.id,
      title: schema.goal.title,
      catId: schema.goal.catId,
      windowSize: schema.goal.windowSize,
      responseToken: schema.goal.responseToken,
    })
    .from(schema.goal)
    .where(eq(schema.goal.ownerId, owner.id))
    .orderBy(desc(schema.goal.createdAt));
}

export type GoalSummary = {
  id: string;
  title: string;
  catId: number;
  windowSize: number;
};

/** A Goal as its Owner sees it, with the Response Link they hand out. */
export type OwnedGoal = GoalSummary & { responseToken: string };

/**
 * The Goal behind a Response Link. The Response form shows the Goal's name and
 * nothing else, so this is deliberately the whole of what a Respondent's page
 * can learn.
 */
export async function findGoalByResponseToken(
  responseToken: string,
): Promise<GoalSummary | null> {
  const [goal] = await db
    .select({
      id: schema.goal.id,
      title: schema.goal.title,
      catId: schema.goal.catId,
      windowSize: schema.goal.windowSize,
    })
    .from(schema.goal)
    .where(eq(schema.goal.responseToken, responseToken))
    .limit(1);

  return goal ?? null;
}
