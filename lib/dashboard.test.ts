import { inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, schema } from "@/db";

import { dashboardFor, openGoal } from "./dashboard";
import { createGoal } from "./goals";
import { type GenerateReport } from "./reports";
import { createResponse } from "./responses";
import { hashToken } from "./tokens";

const mintedOwnerTokens: string[] = [];

/** Every seeded Response comes from its own browser, so the guard lets it in. */
let seededBrowsers = 0;

/** A Goal, with every row it creates cleaned up afterwards. */
async function seedGoal(title: string, ownerToken?: string) {
  const created = await createGoal({ title, ownerToken });
  mintedOwnerTokens.push(created.ownerToken);
  return created;
}

/**
 * Answers a Goal the way a Respondent does, each answer from its own browser
 * so the guard lets it through.
 */
async function seedResponses(
  responseToken: string,
  bodies: string[],
): Promise<void> {
  for (const body of bodies) {
    const result = await createResponse({
      responseToken,
      body,
      browserHash: `browser-${seededBrowsers++}`,
    });
    expect(result).toEqual({ status: "recorded" });
  }
}

/** A generator that writes a Report without calling a model. */
const generateTheme: GenerateReport = async () =>
  "The reasons were mostly about money and timing.";

/**
 * A generator that fails, as the real one does when the provider is down. The
 * log it provokes is silenced so a passing run stays quiet.
 */
const failToGenerate: GenerateReport = async () => {
  throw new Error("the model was unreachable");
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Three ordinary Responses: enough to fill a Goal's first Window. */
const THREE_RESPONSES = [
  "The timing is wrong for us this quarter.",
  "We already booked someone else.",
  "The fee was more than we had budgeted.",
];

afterEach(async () => {
  if (mintedOwnerTokens.length === 0) return;

  const hashes = mintedOwnerTokens.splice(0).map(hashToken);
  // Goals, Responses, Reports and guards all cascade from the Owner.
  await db.delete(schema.owner).where(inArray(schema.owner.tokenHash, hashes));
});

describe("dashboardFor", () => {
  it("shows a new Goal asleep, with no Responses counted against it", async () => {
    const created = await seedGoal("Play the Wigmore Hall");

    const dashboard = await dashboardFor(created.ownerToken);

    expect(dashboard).toEqual([
      expect.objectContaining({
        id: created.goalId,
        title: "Play the Wigmore Hall",
        catId: created.catId,
        pose: "asleep",
        responseCount: 0,
      }),
    ]);
  });

  it("counts each Goal's Responses and tells the Owner nothing about when they arrived", async () => {
    const first = await seedGoal("Raise a seed round");
    const second = await seedGoal("Find a cellist", first.ownerToken);
    await seedResponses(first.responseToken, THREE_RESPONSES);
    await seedResponses(second.responseToken, THREE_RESPONSES.slice(0, 1));

    const dashboard = await dashboardFor(first.ownerToken, generateTheme);
    const counted = new Map(
      dashboard.map((goal) => [goal.title, goal.responseCount]),
    );

    expect(counted).toEqual(
      new Map([
        ["Raise a seed round", 3],
        ["Find a cellist", 1],
      ]),
    );
    // ADR-0003 withholds timing everywhere, so the Dashboard's payload is
    // checked field by field rather than trusting the page not to render one.
    for (const goal of dashboard) {
      expect(Object.keys(goal).sort()).toEqual([
        "catId",
        "id",
        "pose",
        "responseCount",
        "title",
      ]);
    }
  });

  it("wakes a Goal to alert when a filled Window leaves a Report unread", async () => {
    const created = await seedGoal("Play the Wigmore Hall");
    await seedResponses(created.responseToken, THREE_RESPONSES);

    const dashboard = await dashboardFor(created.ownerToken, generateTheme);

    expect(dashboard).toEqual([
      expect.objectContaining({ pose: "alert", responseCount: 3 }),
    ]);
  });

  it("still draws the Dashboard when the Report a Goal owes cannot be generated", async () => {
    // A provider failure: a Window that has filled is owed, not lost.
    const failing = await seedGoal("Play the Wigmore Hall");
    const other = await seedGoal("Find a cellist", failing.ownerToken);
    await seedResponses(failing.responseToken, THREE_RESPONSES);
    await seedResponses(other.responseToken, THREE_RESPONSES.slice(0, 1));

    const dashboard = await dashboardFor(failing.ownerToken, failToGenerate);

    expect(
      new Map(dashboard.map((goal) => [goal.title, goal])),
    ).toEqual(
      new Map([
        [
          "Play the Wigmore Hall",
          expect.objectContaining({ pose: "asleep", responseCount: 3 }),
        ],
        [
          "Find a cellist",
          expect.objectContaining({ pose: "asleep", responseCount: 1 }),
        ],
      ]),
    );

    // And the Window is still owed: the next read writes the Report.
    const retried = await dashboardFor(failing.ownerToken, generateTheme);

    expect(
      retried.find((goal) => goal.title === "Play the Wigmore Hall"),
    ).toMatchObject({ pose: "alert" });
  });

  it("settles a Goal into sitting once its Owner has opened the Reports", async () => {
    const created = await seedGoal("Play the Wigmore Hall");
    await seedResponses(created.responseToken, THREE_RESPONSES);
    await dashboardFor(created.ownerToken, generateTheme);

    // Opening the Goal page is what marks its Reports read.
    await openGoal(created.ownerToken, created.goalId, generateTheme);

    expect(await dashboardFor(created.ownerToken, generateTheme)).toEqual([
      expect.objectContaining({ pose: "sitting", responseCount: 3 }),
    ]);
  });

  it("wakes a sitting Goal again when the next Window fills", async () => {
    const created = await seedGoal("Play the Wigmore Hall");
    await seedResponses(created.responseToken, THREE_RESPONSES);
    await openGoal(created.ownerToken, created.goalId, generateTheme);
    await seedResponses(created.responseToken, [
      "We are not taking anyone new on this year.",
      "The programme does not fit our season.",
      "Our board turned the budget down.",
    ]);

    expect(await dashboardFor(created.ownerToken, generateTheme)).toEqual([
      expect.objectContaining({ pose: "alert", responseCount: 6 }),
    ]);
  });

  it("keeps a failed generation's error, and the Responses in it, out of the log", async () => {
    const created = await seedGoal("Play the Wigmore Hall");
    await seedResponses(created.responseToken, THREE_RESPONSES);

    // A model client that quotes its own request back in the exception, which
    // is ordinary behaviour for an HTTP client — and that request is the
    // Window's Responses, verbatim.
    const echoesItsRequest: GenerateReport = async (prompt) => {
      throw new Error(`502 from the model. Request body: ${prompt.user}`);
    };

    await dashboardFor(created.ownerToken, echoesItsRequest);

    const logged = vi
      .mocked(console.error)
      .mock.calls.flat()
      .map((entry) => (entry instanceof Error ? entry.stack : String(entry)))
      .join("\n");

    // It says a Report could not be written, and says it about a Goal id.
    expect(logged).toContain(created.goalId);
    // ADR-0003: a Respondent's words may not turn up in a server log either.
    for (const response of THREE_RESPONSES) {
      expect(logged).not.toContain(response);
    }
  });

  it("shows nothing at all to an Owner Link that belongs to nobody", async () => {
    await seedGoal("Play the Wigmore Hall");

    expect(await dashboardFor("notAnOwnerLinkToken123")).toEqual([]);
  });
});
