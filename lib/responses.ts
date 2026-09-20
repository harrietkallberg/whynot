import { createHash } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { db, schema } from "@/db";

/**
 * A Response is at least this long. The floor is the point of the rule: three
 * shrugs would consume a Window and produce a Report that says nothing.
 */
export const MIN_RESPONSE_LENGTH = 10;

/** And at most this long. Both bounds are a CHECK on the column as well. */
export const MAX_RESPONSE_LENGTH = 1000;

export type CreateResponseInput = {
  /** The token in the Response Link that was opened. */
  responseToken: string;
  body: string;
  /** Identifies the browser answering, and only for this one Goal. */
  browserHash: string;
};

export type CreateResponseResult =
  | { status: "recorded" }
  /** This browser has already answered this Goal. */
  | { status: "already-responded" }
  | { status: "too-short" }
  | { status: "too-long" }
  /** The Owner got their yes; the Goal takes no more Responses. */
  | { status: "closed" }
  /** The Response Link belongs to no Goal: a typo, or a deleted Goal. */
  | { status: "unknown-goal" };

/**
 * The stored form of what was typed. Leading and trailing whitespace goes,
 * and a textarea's CRLF line endings become LF so a Response is measured in
 * the characters its author can see; the words themselves are untouched.
 */
function normaliseBody(body: string): string {
  return body.replace(/\r\n/g, "\n").trim();
}

/**
 * How long a Response is, in the characters its author typed.
 *
 * Not `String.length`, which counts UTF-16 code units: an emoji is two of
 * those and one of these. The column's CHECK uses Postgres char_length, which
 * counts code points, so measuring the halves would refuse five emoji as too
 * short and then let a thousand of them hit the constraint instead.
 */
export function responseLength(body: string): number {
  return [...body].length;
}

/**
 * Whether a body can be stored at all, or null when it can.
 *
 * Exported so the form's action can turn a hopeless answer away before it
 * gives the browser an identity; createResponse checks it again regardless,
 * because the seam has to hold for any caller.
 */
export function checkResponseLength(
  body: string,
): "too-short" | "too-long" | null {
  const length = responseLength(normaliseBody(body));

  if (length < MIN_RESPONSE_LENGTH) return "too-short";
  if (length > MAX_RESPONSE_LENGTH) return "too-long";
  return null;
}

/**
 * What a browser is called in the `submission_guard` table.
 *
 * The Response Token is folded in, so the same browser hashes differently for
 * every Goal: the guard can then stop a second Response to one Goal without
 * the table ever showing that two Goals were answered by the same person
 * (ADR-0003).
 *
 * Deliberately not hashToken from lib/tokens: that hashes a credential so a
 * leaked table cannot be used to log in, and nothing here is a credential.
 * This hash exists to be unjoinable, which is why it is salted per Goal.
 */
export function browserHashFor(
  browserToken: string,
  responseToken: string,
): string {
  return createHash("sha256")
    .update(`${browserToken}:${responseToken}`)
    .digest("hex");
}

/**
 * Appends one anonymous Response to the Goal behind a Response Link.
 */
export async function createResponse({
  responseToken,
  body,
  browserHash,
}: CreateResponseInput): Promise<CreateResponseResult> {
  // Checked before anything is claimed: an unusable Response must not spend
  // this browser's one shot at the Goal.
  const rejection = checkResponseLength(body);
  if (rejection) return { status: rejection };

  const normalised = normaliseBody(body);

  return db.transaction(async (tx) => {
    // Locking the Goal row is what makes the seq below safe: two Respondents
    // pressing send at the same moment are serialised here, so the second
    // reads the first's Response and takes the seq after it rather than
    // colliding on (goal_id, seq). It also settles the closed check and the
    // write against the same version of the Goal.
    const [goal] = await tx
      .select({ id: schema.goal.id, closedAt: schema.goal.closedAt })
      .from(schema.goal)
      .where(eq(schema.goal.responseToken, responseToken))
      .limit(1)
      .for("update");

    if (!goal) return { status: "unknown-goal" };
    if (goal.closedAt !== null) return { status: "closed" };

    // The guard row is the claim on this Goal, so it is written before the
    // Response: a browser that loses the race writes nothing at all.
    const claimed = await tx
      .insert(schema.submissionGuard)
      .values({ goalId: goal.id, browserHash })
      .onConflictDoNothing()
      .returning({ goalId: schema.submissionGuard.goalId });

    if (claimed.length === 0) return { status: "already-responded" };

    const [{ nextSeq }] = await tx
      .select({
        nextSeq: sql<number>`coalesce(max(${schema.response.seq}), 0) + 1`,
      })
      .from(schema.response)
      .where(eq(schema.response.goalId, goal.id));

    await tx
      .insert(schema.response)
      .values({ goalId: goal.id, seq: nextSeq, body: normalised });

    return { status: "recorded" };
  });
}

/**
 * What the Response Link should put on screen: the form, the closed notice, or
 * the thank-you a browser that has already answered gets back.
 *
 * Everything else about the Goal — how many Responses it has, how big its
 * Window is, who owns it — stays on the Owner's side of the line (ADR-0003),
 * so this deliberately cannot report it.
 */
export type ResponseFormState = "open" | "closed" | "already-responded";

export async function findResponseFormState({
  responseToken,
  browserHash,
}: {
  /** The same identity createResponse takes: the token that was opened. */
  responseToken: string;
  /** Null when the browser carries no token yet, which means it has not. */
  browserHash: string | null;
}): Promise<ResponseFormState> {
  const [goal] = await db
    .select({ id: schema.goal.id, closedAt: schema.goal.closedAt })
    .from(schema.goal)
    .where(eq(schema.goal.responseToken, responseToken))
    .limit(1);

  if (!goal || goal.closedAt !== null) return "closed";
  if (browserHash === null) return "open";

  const [guard] = await db
    .select({ goalId: schema.submissionGuard.goalId })
    .from(schema.submissionGuard)
    .where(
      and(
        eq(schema.submissionGuard.goalId, goal.id),
        eq(schema.submissionGuard.browserHash, browserHash),
      ),
    )
    .limit(1);

  return guard ? "already-responded" : "open";
}
