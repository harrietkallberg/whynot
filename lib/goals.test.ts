import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db, schema } from "@/db";

import { catOfTheDay } from "./cats";
import {
  createGoal,
  findGoalByResponseToken,
  findGoalsByOwnerToken,
  type CreateGoalInput,
} from "./goals";
import { hashToken } from "./tokens";

/** Base58 (Bitcoin alphabet): no 0, O, I or l, always a fixed width. */
const BASE58_TOKEN = /^[1-9A-HJ-NP-Za-km-z]{22}$/;

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

    const dashboard = await findGoalsByOwnerToken(first.ownerToken);

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

    const [goal] = await findGoalsByOwnerToken(created.ownerToken);

    expect(goal.catId).toBe(created.catId);
    expect(goal.windowSize).toBe(3);
  });

  it("leaves no Owner behind when the Goal cannot be written", async () => {
    const ownersBefore = await db.select().from(schema.owner);

    // A title that survives normalisation — a NUL byte is not whitespace — but
    // that Postgres refuses to store. The Owner is minted before the Goal is
    // written, and an Owner whose Goal failed would be unreachable forever,
    // since its token is only ever handed back on success.
    await expect(
      createGoal({ title: "Unwritable\u0000Goal" }),
    ).rejects.toThrow();

    const ownersAfter = await db.select().from(schema.owner);

    expect(ownersAfter.length).toBe(ownersBefore.length);
  });

  it("mints a fresh Owner when the Owner Link belongs to nobody", async () => {
    const created = await createTestGoal({
      title: "Get on the bill",
      ownerToken: "notAnOwnerLinkToken123",
    });

    expect(created.ownerToken).not.toBe("notAnOwnerLinkToken123");

    const dashboard = await findGoalsByOwnerToken(created.ownerToken);

    expect(dashboard.map((goal) => goal.title)).toEqual(["Get on the bill"]);
  });
});
