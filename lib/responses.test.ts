import { asc, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db, schema } from "@/db";

import { createGoal } from "./goals";
import { browserHashFor, createResponse } from "./responses";
import { hashToken } from "./tokens";

const mintedOwnerTokens: string[] = [];

/**
 * Creates a Goal and remembers the Owner behind it, so every row a test writes
 * is removed again and the suite can be run repeatedly.
 */
async function createTestGoal(title: string) {
  const created = await createGoal({ title });
  mintedOwnerTokens.push(created.ownerToken);
  return created;
}

/**
 * The Responses on a Goal, in seq order. Nothing an Owner may call can read
 * Response text (ADR-0003) and nothing a Respondent may call can read another
 * Response at all, so the rows are the only place the seq allocation these
 * tests are about is observable.
 */
async function responsesOf(goalId: string) {
  return db
    .select({ seq: schema.response.seq, body: schema.response.body })
    .from(schema.response)
    .where(eq(schema.response.goalId, goalId))
    .orderBy(asc(schema.response.seq));
}

/**
 * Closing a Goal is the Owner's side of the product and is not built yet, so
 * a test that needs a closed Goal writes the column itself.
 */
async function closeGoal(goalId: string) {
  await db
    .update(schema.goal)
    .set({ closedAt: new Date() })
    .where(eq(schema.goal.id, goalId));
}

afterEach(async () => {
  if (mintedOwnerTokens.length === 0) return;

  const hashes = mintedOwnerTokens.splice(0).map(hashToken);
  // Goals cascade from their Owner, and Responses and guards from their Goal.
  await db.delete(schema.owner).where(inArray(schema.owner.tokenHash, hashes));
});

describe("createResponse", () => {
  it("records the first Response to a Goal at seq 1", async () => {
    const goal = await createTestGoal("Play the Wigmore Hall");

    const result = await createResponse({
      responseToken: goal.responseToken,
      body: "The programme did not fit our season.",
      browserHash: browserHashFor("a-browser", goal.responseToken),
    });

    expect(result).toEqual({ status: "recorded" });
    expect(await responsesOf(goal.goalId)).toEqual([
      { seq: 1, body: "The programme did not fit our season." },
    ]);
  });

  it("takes a Response from a second browser at the next seq, since colleagues share a network", async () => {
    const goal = await createTestGoal("Play the Wigmore Hall");

    await createResponse({
      responseToken: goal.responseToken,
      body: "The programme did not fit our season.",
      browserHash: browserHashFor("a-browser", goal.responseToken),
    });
    const second = await createResponse({
      responseToken: goal.responseToken,
      body: "We book that slot a year ahead.",
      browserHash: browserHashFor("another-browser", goal.responseToken),
    });

    expect(second).toEqual({ status: "recorded" });
    expect(await responsesOf(goal.goalId)).toEqual([
      { seq: 1, body: "The programme did not fit our season." },
      { seq: 2, body: "We book that slot a year ahead." },
    ]);
  });

  it("refuses a second Response from a browser that has already answered that Goal", async () => {
    const goal = await createTestGoal("Play the Wigmore Hall");
    const browserHash = browserHashFor("a-browser", goal.responseToken);

    await createResponse({
      responseToken: goal.responseToken,
      body: "The programme did not fit our season.",
      browserHash,
    });
    const again = await createResponse({
      responseToken: goal.responseToken,
      body: "On reflection, the fee was the problem.",
      browserHash,
    });

    expect(again).toEqual({ status: "already-responded" });
    expect(await responsesOf(goal.goalId)).toEqual([
      { seq: 1, body: "The programme did not fit our season." },
    ]);
  });

  it("lets the same browser answer a different Goal", async () => {
    const first = await createTestGoal("Play the Wigmore Hall");
    const second = await createTestGoal("Find a cellist");

    await createResponse({
      responseToken: first.responseToken,
      body: "The programme did not fit our season.",
      browserHash: browserHashFor("a-browser", first.responseToken),
    });
    const other = await createResponse({
      responseToken: second.responseToken,
      body: "I am booked for the whole of that month.",
      browserHash: browserHashFor("a-browser", second.responseToken),
    });

    expect(other).toEqual({ status: "recorded" });
    expect(await responsesOf(second.goalId)).toEqual([
      { seq: 1, body: "I am booked for the whole of that month." },
    ]);
  });

  it("refuses a shrug: three words padded with whitespace is still too short", async () => {
    const goal = await createTestGoal("Play the Wigmore Hall");

    const result = await createResponse({
      responseToken: goal.responseToken,
      body: "   nah    ",
      browserHash: browserHashFor("a-browser", goal.responseToken),
    });

    expect(result).toEqual({ status: "too-short" });
    expect(await responsesOf(goal.goalId)).toEqual([]);
  });

  it("refuses a Response over a thousand characters", async () => {
    const goal = await createTestGoal("Play the Wigmore Hall");

    const result = await createResponse({
      responseToken: goal.responseToken,
      body: "n".repeat(1001),
      browserHash: browserHashFor("a-browser", goal.responseToken),
    });

    expect(result).toEqual({ status: "too-long" });
    expect(await responsesOf(goal.goalId)).toEqual([]);
  });

  it("stores the Response trimmed, and leaves the words inside it alone", async () => {
    const goal = await createTestGoal("Play the Wigmore Hall");

    await createResponse({
      responseToken: goal.responseToken,
      body: "\r\n  The fee.\r\n\r\n  And the date.  \r\n",
      browserHash: browserHashFor("a-browser", goal.responseToken),
    });

    expect(await responsesOf(goal.goalId)).toEqual([
      { seq: 1, body: "The fee.\n\n  And the date." },
    ]);
  });

  it("refuses a browser that never claimed a Goal when the Response is unusable", async () => {
    const goal = await createTestGoal("Play the Wigmore Hall");
    const browserHash = browserHashFor("a-browser", goal.responseToken);

    await createResponse({
      responseToken: goal.responseToken,
      body: "nah",
      browserHash,
    });
    const second = await createResponse({
      responseToken: goal.responseToken,
      body: "The programme did not fit our season.",
      browserHash,
    });

    expect(second).toEqual({ status: "recorded" });
  });

  it("refuses a Response Link that belongs to no Goal", async () => {
    const result = await createResponse({
      responseToken: "notAResponseLinkToken1",
      body: "The programme did not fit our season.",
      browserHash: browserHashFor("a-browser", "notAResponseLinkToken1"),
    });

    expect(result).toEqual({ status: "unknown-goal" });
  });

  it("refuses a closed Goal, because they got their yes", async () => {
    const goal = await createTestGoal("Play the Wigmore Hall");
    await closeGoal(goal.goalId);

    const result = await createResponse({
      responseToken: goal.responseToken,
      body: "The programme did not fit our season.",
      browserHash: browserHashFor("a-browser", goal.responseToken),
    });

    expect(result).toEqual({ status: "closed" });
    expect(await responsesOf(goal.goalId)).toEqual([]);
  });

  it("gives two browsers answering at the same moment a seq each", async () => {
    const goal = await createTestGoal("Play the Wigmore Hall");

    const results = await Promise.all(
      ["one", "two", "three", "four"].map((browser) =>
        createResponse({
          responseToken: goal.responseToken,
          body: `Browser ${browser} could not make it work.`,
          browserHash: browserHashFor(browser, goal.responseToken),
        }),
      ),
    );

    expect(results).toEqual([
      { status: "recorded" },
      { status: "recorded" },
      { status: "recorded" },
      { status: "recorded" },
    ]);
    expect((await responsesOf(goal.goalId)).map((r) => r.seq)).toEqual([
      1, 2, 3, 4,
    ]);
  });
});
