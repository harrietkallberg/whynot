import { and, eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";

import { db, schema } from "@/db";

import { catOfTheDay } from "./cats";
import { normaliseTitle } from "./goal-title";
import { mintOwner, resolveOwner, type Executor } from "./owner";
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
  executor: Executor,
): Promise<{ id: string; ownerToken: string }> {
  if (ownerToken) {
    const existing = await resolveOwner(ownerToken, executor);
    if (existing) return { id: existing.id, ownerToken };
  }

  return mintOwner(executor);
}

/**
 * Creates a Goal, minting an Owner for it when the browser does not already
 * hold an Owner Link.
 *
 * Both rows are written in one transaction. A newly minted Owner whose Goal
 * fails to insert would be unreachable forever — its token is only ever
 * returned on success — so it must not survive the failure.
 */
export async function createGoal({
  title: rawTitle,
  ownerToken: existingOwnerToken,
}: CreateGoalInput): Promise<CreatedGoal> {
  const title = normaliseTitle(rawTitle);
  const responseToken = mintToken();
  const catId = catOfTheDay(new Date());

  return db.transaction(async (tx) => {
    const owner = await ownerFor(existingOwnerToken, tx);

    const [goal] = await tx
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
  });
}

/** The smallest Window an Owner may choose. Also a CHECK on the column. */
export const MIN_WINDOW_SIZE = 3;

/** And the largest. */
export const MAX_WINDOW_SIZE = 30;

/**
 * A Goal id as it arrives from a URL. Checked before it reaches a query,
 * because Postgres raises on a malformed uuid: a mistyped link is a Goal the
 * caller does not own, not a server error.
 */
const GOAL_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGoalId(value: string): boolean {
  return GOAL_ID.test(value);
}

/**
 * What became of an attempt to change a Goal. `not-owned` is the answer to an
 * unknown Owner Link, another Owner's Goal, a Goal that is already gone and a
 * Response Link used as though it were an Owner Link — all four are the same
 * refusal on purpose, so nobody can tell them apart from outside (ADR-0002).
 */
export type WindowSizeChange = "queued" | "out-of-range" | "not-owned";
export type GoalClosure = "closed" | "not-owned";
export type GoalDeletion = "deleted" | "not-owned";

/**
 * Applies a change to a Goal the caller owns, and refuses otherwise.
 *
 * Ownership is a condition of the statement rather than a lookup before it:
 * one round trip, and no window between the check and the write in which a
 * Goal could change hands.
 */
async function updateOwnedGoal(
  ownerToken: string,
  goalId: string,
  values: PgUpdateSetSource<typeof schema.goal>,
): Promise<boolean> {
  const owner = await resolveOwner(ownerToken);
  if (!owner || !isGoalId(goalId)) return false;

  const changed = await db
    .update(schema.goal)
    .set(values)
    .where(and(eq(schema.goal.id, goalId), eq(schema.goal.ownerId, owner.id)))
    .returning({ id: schema.goal.id });

  return changed.length === 1;
}

/**
 * Queues a new Window Size, which takes effect on the next Window.
 *
 * It never touches the size of the Window currently filling: a Report covers
 * exactly the Window it was written for and is never widened (ADR-0001), so a
 * Window that has already started collecting keeps the size it started with
 * and the new value is promoted when that Window closes.
 *
 * A closed Goal accepts the change as readily as an open one. It takes no more
 * Responses so nothing comes of it, and refusing would mean a second way for
 * this to fail with nothing to gain.
 */
export async function setWindowSize(
  ownerToken: string,
  goalId: string,
  size: number,
): Promise<WindowSizeChange> {
  if (
    !Number.isInteger(size) ||
    size < MIN_WINDOW_SIZE ||
    size > MAX_WINDOW_SIZE
  ) {
    return "out-of-range";
  }

  return (await updateOwnedGoal(ownerToken, goalId, { nextWindowSize: size }))
    ? "queued"
    : "not-owned";
}

/**
 * The Owner got their yes. The Goal stops taking Responses and everything
 * already written stays exactly where it is, so its Reports go on being
 * readable — closing is the end of collection, not of the archive.
 *
 * Closing twice is closing once: the mark is left as it was found.
 */
export async function closeGoal(
  ownerToken: string,
  goalId: string,
): Promise<GoalClosure> {
  const closed = await updateOwnedGoal(ownerToken, goalId, {
    closedAt: sql`coalesce(${schema.goal.closedAt}, now())`,
  });

  return closed ? "closed" : "not-owned";
}

/**
 * Removes a Goal and everything under it: its Responses, its Reports and the
 * guards that stopped a browser answering twice, all by cascade from the row
 * deleted here. The Response Link stops opening anything.
 */
export async function deleteGoal(
  ownerToken: string,
  goalId: string,
): Promise<GoalDeletion> {
  const owner = await resolveOwner(ownerToken);
  if (!owner || !isGoalId(goalId)) return "not-owned";

  const deleted = await db
    .delete(schema.goal)
    .where(and(eq(schema.goal.id, goalId), eq(schema.goal.ownerId, owner.id)))
    .returning({ id: schema.goal.id });

  return deleted.length === 1 ? "deleted" : "not-owned";
}

/**
 * A Goal as a Respondent sees it: its name, and nothing else at all. Window
 * Size, the Cat and every count stay on the Owner's side of the line.
 */
export type RespondentGoal = {
  id: string;
  title: string;
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
