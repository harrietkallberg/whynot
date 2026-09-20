import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/db";

import { catOfTheDay } from "./cats";
import { normaliseTitle } from "./goal-title";
import { mintOwner, resolveOwner } from "./owner";
import { mintToken } from "./tokens";

export type CreateGoalInput = {
  title: string;
  /** An Owner Link token held by a returning browser, if there is one. */
  ownerToken?: string | null;
};

export type CreatedGoal = {
  goalId: string;
  title: string;
  catId: number;
  /** Shown once, never recoverable, never logged (ADR-0002). */
  ownerToken: string;
  responseToken: string;
};

/**
 * The Owner this Goal belongs to: the one behind the Owner Link the browser
 * already holds, or a new one.
 *
 * A token that matches nobody — a wiped database, a mangled paste — mints a
 * fresh Owner rather than failing, because the alternative is a dead end in
 * the only flow the app has. The new Owner Link is then shown with the usual
 * warning, so nothing is replaced behind the Owner's back.
 */
async function ownerFor(
  ownerToken: string | null | undefined,
): Promise<{ id: string; ownerToken: string }> {
  if (ownerToken) {
    const existing = await resolveOwner(ownerToken);
    if (existing) return { id: existing.id, ownerToken };
  }

  return mintOwner();
}

/**
 * Creates a Goal, minting an Owner for it when the browser does not already
 * hold an Owner Link.
 */
export async function createGoal({
  title: rawTitle,
  ownerToken: existingOwnerToken,
}: CreateGoalInput): Promise<CreatedGoal> {
  const title = normaliseTitle(rawTitle);

  const owner = await ownerFor(existingOwnerToken);

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

/**
 * A Goal as a Respondent sees it: its name, and nothing else at all. Window
 * Size, the Cat and every count stay on the Owner's side of the line.
 */
export type RespondentGoal = {
  id: string;
  title: string;
};

/** A Goal as its Owner sees it, with the Response Link they hand out. */
export type OwnedGoal = RespondentGoal & {
  catId: number;
  windowSize: number;
  responseToken: string;
};

/**
 * The Goal behind a Response Link. The Response form shows the Goal's name and
 * nothing else, so this is deliberately the whole of what a Respondent's page
 * can learn.
 */
export async function findGoalByResponseToken(
  responseToken: string,
): Promise<RespondentGoal | null> {
  const [goal] = await db
    .select({
      id: schema.goal.id,
      title: schema.goal.title,
    })
    .from(schema.goal)
    .where(eq(schema.goal.responseToken, responseToken))
    .limit(1);

  return goal ?? null;
}
