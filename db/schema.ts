import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * An Owner is identified solely by possession of their Owner Link. The token is
 * stored hashed: it is the only credential in the system, so a database leak
 * must not hand over every Dashboard (ADR-0002).
 */
export const owner = pgTable("owner", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * The Response Token is stored in the clear: it is shared widely by design and
 * protects nothing.
 *
 * windowSize is the size in force for the Window currently filling.
 * nextWindowSize is a pending change, promoted when a Report closes that
 * Window, so a change never resizes a Window already in progress (ADR-0001).
 */
export const goal = pgTable(
  "goal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owner.id, { onDelete: "cascade" }),
    responseToken: text("response_token").notNull().unique(),
    title: text("title").notNull(),
    catId: smallint("cat_id").notNull(),
    windowSize: smallint("window_size").notNull().default(3),
    nextWindowSize: smallint("next_window_size"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("goal_window_size_range", sql`${t.windowSize} between 3 and 30`),
    check(
      "goal_next_window_size_range",
      sql`${t.nextWindowSize} is null or ${t.nextWindowSize} between 3 and 30`,
    ),
  ],
);

/**
 * seq is per-Goal and monotonic, and is what Window boundaries are expressed
 * in. createdAt is bookkeeping only: ADR-0003 forbids exposing timing to an
 * Owner, so this column must never reach a page, payload or log.
 */
export const response = pgTable(
  "response",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goal.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("response_goal_seq").on(t.goalId, t.seq),
    check("response_body_length", sql`char_length(${t.body}) between 10 and 1000`),
  ],
);

/**
 * A Report is written once and never regenerated or widened (ADR-0001). It
 * carries its own boundaries and the Window Size in force at the time, because
 * once that size can change, historical boundaries are not recoverable from
 * the Goal's current value.
 */
export const report = pgTable(
  "report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goal.id, { onDelete: "cascade" }),
    windowIndex: integer("window_index").notNull(),
    fromSeq: integer("from_seq").notNull(),
    toSeq: integer("to_seq").notNull(),
    windowSize: smallint("window_size").notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("report_goal_window").on(t.goalId, t.windowIndex),
    check("report_window_size_range", sql`${t.windowSize} between 3 and 30`),
    // A Window is exactly windowSize Responses, so its inclusive span has to
    // match. Without this the database accepts rows like from=1, to=20,
    // size=3 — a Report asserting a 20-Response Window that claims to be 3,
    // which contradicts the fixed-Window guarantee in ADR-0001. This also
    // makes fromSeq <= toSeq redundant.
    check(
      "report_window_span",
      sql`${t.toSeq} - ${t.fromSeq} + 1 = ${t.windowSize}`,
    ),
  ],
);

/**
 * Deliberately holds no reference to a Response and no timestamp. Putting the
 * browser hash on the response row, or recording when a guard was written,
 * would tie a browser to content or to timing — the correlations ADR-0003
 * exists to prevent.
 */
export const submissionGuard = pgTable(
  "submission_guard",
  {
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goal.id, { onDelete: "cascade" }),
    browserHash: text("browser_hash").notNull(),
  },
  (t) => [primaryKey({ columns: [t.goalId, t.browserHash] })],
);
