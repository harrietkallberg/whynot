import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db, schema } from "@/db";

import { isGoalId } from "./goals";
import { resolveOwner } from "./owner";
import {
  generateReportWithModel,
  maybeGenerateReport,
  type GenerateReport,
} from "./reports";

/**
 * The Owner's side of the product: the Dashboard behind an Owner Link.
 *
 * Nothing here returns a timestamp. Not a created time, not a read time, not
 * a "last Response" — a live counter beside a known send time identifies a
 * Respondent with no text at all (ADR-0003), so times stop at this module and
 * counts are the only quantity that leaves it.
 */

/**
 * The drawing of a Goal's Cat, which is the whole of its status display: a
 * Window still filling is asleep, an unread Report is alert, and a Goal whose
 * Reports have all been read is sitting.
 */
export type Pose = "asleep" | "alert" | "sitting";

/** One row of the Dashboard: a Goal as its Owner sees it. */
export type DashboardGoal = {
  id: string;
  title: string;
  catId: number;
  pose: Pose;
  /** How many Responses the Goal has had. Never when any of them arrived. */
  responseCount: number;
};

/**
 * Every Goal behind an Owner Link, newest first, because a returning Owner is
 * usually here about the Goal they just made.
 *
 * An Owner Link that belongs to nobody gets an empty Dashboard rather than an
 * error: the token is the whole credential (ADR-0002), so a wrong one is a
 * stranger and a stranger is shown nothing.
 */
export async function dashboardFor(
  ownerToken: string,
  generate: GenerateReport = generateReportWithModel,
): Promise<DashboardGoal[]> {
  const owner = await resolveOwner(ownerToken);
  if (!owner) return [];

  const goals = await db
    .select({
      id: schema.goal.id,
      title: schema.goal.title,
      catId: schema.goal.catId,
    })
    .from(schema.goal)
    .where(eq(schema.goal.ownerId, owner.id))
    .orderBy(desc(schema.goal.createdAt));

  if (goals.length === 0) return [];

  const goalIds = goals.map((goal) => goal.id);
  await catchUpReports(goalIds, generate);

  const [responseCounts, reportCounts] = await Promise.all([
    countResponses(goalIds),
    countReports(goalIds),
  ]);

  return goals.map((goal) => ({
    ...goal,
    pose: poseOf(reportCounts.get(goal.id)),
    responseCount: responseCounts.get(goal.id) ?? 0,
  }));
}

/**
 * One Report as its Owner reads it: the text, and the stretch of Responses it
 * covers. Reading a Goal's Reports in order is the product, so they carry
 * their place in the sequence and nothing about when they were written
 * (ADR-0003).
 */
export type OwnedReport = {
  id: string;
  /** 1 for the Goal's first Window, 2 for its second, and so on. */
  windowIndex: number;
  /** The Window this Report covers, as the Responses in it: 4 to 6. */
  fromSeq: number;
  toSeq: number;
  body: string;
};

/** A Goal as its own page shows it, with everything the Owner can act on. */
export type OpenedGoal = DashboardGoal & {
  /** The token in the Response Link the Owner hands out. */
  responseToken: string;
  /** The size of the Window currently filling, which never changes under it. */
  windowSize: number;
  /** A queued size, waiting for the current Window to close (ADR-0001). */
  nextWindowSize: number | null;
  /** The Owner got their yes; no more Responses are taken. */
  closed: boolean;
  /** Oldest Window first: read down the page to see the nos change. */
  reports: OwnedReport[];
  /**
   * A Window has filled and its Report could not be written just now. Nothing
   * is lost — the Window stays owed and the next read tries again — so the
   * page says so rather than pretending the Responses never arrived.
   */
  reportPending: boolean;
};

/**
 * One of the Owner's Goals, with its Reports, or null when the Owner Link does
 * not open that Goal — an unknown token, someone else's Goal, or one that has
 * been deleted. All three are the same answer on purpose: a stranger learns
 * nothing about which Goals exist.
 *
 * Opening a Goal marks its Reports read, which is what settles its Cat from
 * alert to sitting. Reading them is the only signal the product has that they
 * have been read, and the Dashboard deliberately does not do it: a Goal that
 * was merely listed has not been read.
 */
export async function openGoal(
  ownerToken: string,
  goalId: string,
  generate: GenerateReport = generateReportWithModel,
): Promise<OpenedGoal | null> {
  const owner = await resolveOwner(ownerToken);
  if (!owner || !isGoalId(goalId)) return null;

  const [goal] = await db
    .select({
      id: schema.goal.id,
      title: schema.goal.title,
      catId: schema.goal.catId,
      responseToken: schema.goal.responseToken,
      windowSize: schema.goal.windowSize,
      nextWindowSize: schema.goal.nextWindowSize,
      closedAt: schema.goal.closedAt,
    })
    .from(schema.goal)
    .where(and(eq(schema.goal.id, goalId), eq(schema.goal.ownerId, owner.id)))
    .limit(1);

  if (!goal) return null;

  const stillOwed = await catchUpReports([goal.id], generate);

  const reports = await db
    .select({
      id: schema.report.id,
      windowIndex: schema.report.windowIndex,
      fromSeq: schema.report.fromSeq,
      toSeq: schema.report.toSeq,
      body: schema.report.body,
    })
    .from(schema.report)
    .where(eq(schema.report.goalId, goal.id))
    .orderBy(asc(schema.report.windowIndex));

  await markReportsRead(goal.id);

  const responseCounts = await countResponses([goal.id]);

  return {
    id: goal.id,
    title: goal.title,
    catId: goal.catId,
    // Read by the time they are on screen, so the Cat has already settled.
    pose: reports.length === 0 ? "asleep" : "sitting",
    responseCount: responseCounts.get(goal.id) ?? 0,
    responseToken: goal.responseToken,
    windowSize: goal.windowSize,
    nextWindowSize: goal.nextWindowSize,
    closed: goal.closedAt !== null,
    reports,
    reportPending: stillOwed.has(goal.id),
  };
}

/**
 * Marks every unread Report on a Goal as read. The read time is bookkeeping
 * for the Pose and never leaves this module (ADR-0003); a Report itself is
 * untouched, because nothing may rewrite one (ADR-0001).
 */
async function markReportsRead(goalId: string): Promise<void> {
  await db
    .update(schema.report)
    .set({ readAt: new Date() })
    .where(
      and(eq(schema.report.goalId, goalId), isNull(schema.report.readAt)),
    );
}

/** How many Reports a Goal has, and how many of them the Owner has not read. */
type ReportTally = { written: number; unread: number };

/**
 * The Pose a Goal's Cat is drawn in, from its Reports alone.
 *
 * A Goal with no Report yet is asleep, which covers both the ordinary case —
 * the current Window is still filling — and a Window that has filled but whose
 * Report could not be generated. The Cat wakes when there is something to
 * read, never on the arrival of an individual Response (ADR-0003).
 */
function poseOf(tally: ReportTally | undefined): Pose {
  if (!tally || tally.written === 0) return "asleep";
  return tally.unread > 0 ? "alert" : "sitting";
}

/**
 * Writes any Report these Goals owe, and hands back the Goals whose
 * generation failed rather than raising.
 *
 * Generation is lazy and has no queue behind it (see lib/reports.ts), so this
 * is where a Window that filled since the last page load turns into a Report.
 * A failure leaves the Window owed and the next read tries again, so it must
 * not take the page down with it: an Owner whose model call is broken still
 * gets their Goals, their counts and every Report already written.
 */
async function catchUpReports(
  goalIds: string[],
  generate: GenerateReport,
): Promise<Set<string>> {
  const owed = new Set<string>();

  await Promise.all(
    goalIds.map(async (goalId) => {
      try {
        await maybeGenerateReport(goalId, generate);
      } catch (error) {
        owed.add(goalId);
        // Safe to log: a Goal id is not a credential, and nothing here
        // carries an Owner Link or a Response (ADR-0002, ADR-0003).
        console.error(
          `Could not write the Report owed by Goal ${goalId}`,
          error,
        );
      }
    }),
  );

  return owed;
}

/** How many Responses each of these Goals has, by Goal id. */
async function countResponses(goalIds: string[]): Promise<Map<string, number>> {
  const rows = await db
    .select({ goalId: schema.response.goalId, responses: count() })
    .from(schema.response)
    .where(inArray(schema.response.goalId, goalIds))
    .groupBy(schema.response.goalId);

  return new Map(rows.map((row) => [row.goalId, row.responses]));
}

/** How many Reports each of these Goals has, read and unread, by Goal id. */
async function countReports(
  goalIds: string[],
): Promise<Map<string, ReportTally>> {
  const rows = await db
    .select({
      goalId: schema.report.goalId,
      written: count(),
      unread: count(sql`case when ${isNull(schema.report.readAt)} then 1 end`),
    })
    .from(schema.report)
    .where(inArray(schema.report.goalId, goalIds))
    .groupBy(schema.report.goalId);

  return new Map(
    rows.map((row) => [row.goalId, { written: row.written, unread: row.unread }]),
  );
}
