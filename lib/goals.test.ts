import { eq, inArray, isNull } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db, schema } from "@/db";

import { catOfTheDay } from "./cats";
import { dashboardFor, openGoal } from "./dashboard";
import {
  closeGoal,
  createGoal,
  deleteGoal,
  findGoalByResponseToken,
  setWindowSize,
  type CreateGoalInput,
} from "./goals";
import { createResponse } from "./responses";
import { hashToken } from "./tokens";

/** Base58 (Bitcoin alphabet): no 0, O, I or l, always a fixed width. */
const BASE58_TOKEN = /^[1-9A-HJ-NP-Za-km-z]{22}$/;

/** Three ordinary Responses: enough to fill a Goal's first Window. */
const THREE_RESPONSES = [
  "The timing is wrong for us this quarter.",
  "We already booked someone else.",
  "The fee was more than we had budgeted.",
];

const mintedOwnerTokens: string[] = [];

/**
 * Creates a Goal and remembers whichever Owner came back, so every row a test
 * writes is removed again and the suite can be run repeatedly.
 */
async function createTestGoal(input: CreateGoalInput) {
  const created = await createGoal(input);
  mintedOwnerTokens.push(created.ownerToken);
  return created;
}

/**
 * Every Owner with no Goal at all. Nothing writes one on purpose: an Owner is
 * minted in the same transaction as the Goal that caused it.
 */
async function strandedOwnerIds(): Promise<string[]> {
  const rows = await db
    .select({ id: schema.owner.id })
    .from(schema.owner)
    .leftJoin(schema.goal, eq(schema.goal.ownerId, schema.owner.id))
    .where(isNull(schema.goal.id));

  return rows.map((row) => row.id);
}

/**
 * What is left under a Goal. A deleted Goal takes its Responses, Reports and
 * guards with it, and the rows are the only place that is visible: no seam an
 * Owner may call reads a Response (ADR-0003).
 */
async function rowsLeftBehind(goalId: string) {
  const [responses, reports, guards] = await Promise.all([
    db.select().from(schema.response).where(eq(schema.response.goalId, goalId)),
    db.select().from(schema.report).where(eq(schema.report.goalId, goalId)),
    db
      .select()
      .from(schema.submissionGuard)
      .where(eq(schema.submissionGuard.goalId, goalId)),
  ]);

  return {
    responses: responses.length,
    reports: reports.length,
    guards: guards.length,
  };
}

afterEach(async () => {
  if (mintedOwnerTokens.length === 0) return;

  const hashes = mintedOwnerTokens.splice(0).map(hashToken);
  // Goals cascade from their Owner, so deleting the Owner clears both.
  await db.delete(schema.owner).where(inArray(schema.owner.tokenHash, hashes));
});

describe("createGoal", () => {
  it("hands back an Owner Link token and a Response Link token", async () => {
    const created = await createTestGoal({ title: "Play the Wigmore Hall" });

    expect(created.ownerToken).toMatch(BASE58_TOKEN);
    expect(created.responseToken).toMatch(BASE58_TOKEN);
    expect(created.responseToken).not.toBe(created.ownerToken);
  });

  it("opens the Goal to anyone holding its Response Link", async () => {
    const created = await createTestGoal({ title: "Play the Wigmore Hall" });

    const goal = await findGoalByResponseToken(created.responseToken);

    expect(goal).toMatchObject({
      id: created.goalId,
      title: "Play the Wigmore Hall",
    });
  });

  it("reuses the Owner behind an Owner Link, so a second Goal lands on the same Dashboard", async () => {
    const first = await createTestGoal({ title: "Raise a seed round" });
    const second = await createTestGoal({
      title: "Find a cellist",
      ownerToken: first.ownerToken,
    });

    expect(second.ownerToken).toBe(first.ownerToken);

    const dashboard = await dashboardFor(first.ownerToken);

    expect(dashboard.map((goal) => goal.title).sort()).toEqual([
      "Find a cellist",
      "Raise a seed round",
    ]);
  });

  it("names the Goal by its trimmed title and refuses an empty one", async () => {
    const created = await createTestGoal({ title: "   Get a book deal   " });

    expect(created.title).toBe("Get a book deal");

    await expect(createGoal({ title: "   " })).rejects.toThrow();
  });

  it("freezes the Cat of the Day and starts at a Window Size of three", async () => {
    const created = await createTestGoal({ title: "Sell the flat" });

    expect(created.catId).toBe(catOfTheDay(new Date()));

    const goal = await openGoal(created.ownerToken, created.goalId);

    expect(goal).toMatchObject({ catId: created.catId, windowSize: 3 });
  });

  it("leaves no Owner behind when the Goal cannot be written", async () => {
    // Scoped to Owners with no Goal, not to every Owner row: an Owner is only
    // ever written alongside its first Goal, in one transaction, so a Goalless
    // Owner is exactly the leak this test is about — and counting the whole
    // table would instead count whatever another test file is doing at the
    // same moment, which Vitest runs in parallel by default.
    const strandedBefore = await strandedOwnerIds();

    // A title that survives normalisation — a NUL byte is not whitespace — but
    // that Postgres refuses to store. The Owner is minted before the Goal is
    // written, and an Owner whose Goal failed would be unreachable forever,
    // since its token is only ever handed back on success.
    await expect(
      createGoal({ title: "Unwritable\u0000Goal" }),
    ).rejects.toThrow();

    const strandedAfter = await strandedOwnerIds();

    expect(
      strandedAfter.filter((id) => !strandedBefore.includes(id)),
    ).toEqual([]);
  });

  it("mints a fresh Owner when the Owner Link belongs to nobody", async () => {
    const created = await createTestGoal({
      title: "Get on the bill",
      ownerToken: "notAnOwnerLinkToken123",
    });

    expect(created.ownerToken).not.toBe("notAnOwnerLinkToken123");

    const dashboard = await dashboardFor(created.ownerToken);

    expect(dashboard.map((goal) => goal.title)).toEqual(["Get on the bill"]);
  });
});

describe("setWindowSize", () => {
  it("queues the new size for the next Window and leaves the filling one alone", async () => {
    const created = await createTestGoal({ title: "Play the Wigmore Hall" });

    expect(await setWindowSize(created.ownerToken, created.goalId, 10)).toBe(
      "queued",
    );

    // ADR-0001: the Window currently filling keeps the size it started with,
    // so no Report ever covers a count that matches no setting that existed.
    expect(await openGoal(created.ownerToken, created.goalId)).toMatchObject({
      windowSize: 3,
      nextWindowSize: 10,
    });
  });

  it("refuses a size outside three to thirty, and one that is not a whole number", async () => {
    const created = await createTestGoal({ title: "Play the Wigmore Hall" });

    for (const size of [2, 31, 0, -3, 7.5, Number.NaN]) {
      expect(await setWindowSize(created.ownerToken, created.goalId, size)).toBe(
        "out-of-range",
      );
    }

    expect(await openGoal(created.ownerToken, created.goalId)).toMatchObject({
      windowSize: 3,
      nextWindowSize: null,
    });
  });

  it("refuses anyone who does not hold the Goal's Owner Link", async () => {
    const created = await createTestGoal({ title: "Play the Wigmore Hall" });
    const stranger = await createTestGoal({ title: "Find a cellist" });

    // The Response Link is handed to everyone who said no, so it must not
    // resize anything; nor may another Owner's Link reach across.
    expect(
      await setWindowSize(created.responseToken, created.goalId, 10),
    ).toBe("not-owned");
    expect(await setWindowSize(stranger.ownerToken, created.goalId, 10)).toBe(
      "not-owned",
    );

    expect(await openGoal(created.ownerToken, created.goalId)).toMatchObject({
      nextWindowSize: null,
    });
  });
});

describe("closeGoal", () => {
  it("stops new Responses and leaves the Goal readable to its Owner", async () => {
    const created = await createTestGoal({ title: "Play the Wigmore Hall" });

    expect(await closeGoal(created.ownerToken, created.goalId)).toBe("closed");

    expect(
      await createResponse({
        responseToken: created.responseToken,
        body: "We had already picked someone else.",
        browserHash: "browser-after-closing",
      }),
    ).toEqual({ status: "closed" });

    expect(await openGoal(created.ownerToken, created.goalId)).toMatchObject({
      closed: true,
      title: "Play the Wigmore Hall",
    });
  });

  it("refuses anyone who does not hold the Goal's Owner Link", async () => {
    const created = await createTestGoal({ title: "Play the Wigmore Hall" });
    const stranger = await createTestGoal({ title: "Find a cellist" });

    expect(await closeGoal(created.responseToken, created.goalId)).toBe(
      "not-owned",
    );
    expect(await closeGoal(stranger.ownerToken, created.goalId)).toBe(
      "not-owned",
    );

    expect(await openGoal(created.ownerToken, created.goalId)).toMatchObject({
      closed: false,
    });
  });
});

describe("deleteGoal", () => {
  it("removes the Goal and every Response, Report and guard under it", async () => {
    const created = await createTestGoal({ title: "Play the Wigmore Hall" });
    for (const [offset, body] of THREE_RESPONSES.entries()) {
      await createResponse({
        responseToken: created.responseToken,
        body,
        browserHash: `browser-${created.goalId}-${offset}`,
      });
    }
    await openGoal(created.ownerToken, created.goalId, async () => "themes");

    expect(await deleteGoal(created.ownerToken, created.goalId)).toBe(
      "deleted",
    );

    expect(await dashboardFor(created.ownerToken)).toEqual([]);
    expect(await findGoalByResponseToken(created.responseToken)).toBeNull();
    expect(await rowsLeftBehind(created.goalId)).toEqual({
      responses: 0,
      reports: 0,
      guards: 0,
    });
  });

  it("refuses anyone who does not hold the Goal's Owner Link", async () => {
    const created = await createTestGoal({ title: "Play the Wigmore Hall" });
    const stranger = await createTestGoal({ title: "Find a cellist" });

    expect(await deleteGoal(created.responseToken, created.goalId)).toBe(
      "not-owned",
    );
    expect(await deleteGoal(stranger.ownerToken, created.goalId)).toBe(
      "not-owned",
    );

    expect(await findGoalByResponseToken(created.responseToken)).toMatchObject({
      id: created.goalId,
    });
  });
});
