"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import {
  closeGoal,
  deleteGoal,
  MAX_WINDOW_SIZE,
  MIN_WINDOW_SIZE,
  setWindowSize,
} from "@/lib/goals";

/**
 * Everything an Owner can do to a Goal from its page.
 *
 * A Server Function is reachable by POST whether or not the page offered the
 * button, so each one hands the Owner Link straight to the seam that checks
 * it: possession of that link is the whole credential (ADR-0002), and holding
 * a Response Link instead must close and delete precisely nothing.
 *
 * Nothing here logs a token or puts one in a message, and none of these
 * functions returns anything about the Goal beyond what the page already
 * shows.
 */

/** What the Owner Link and the Goal are called on every form here. */
function credentials(formData: FormData): {
  ownerToken: string;
  goalId: string;
} {
  return {
    ownerToken: String(formData.get("ownerToken") ?? ""),
    goalId: String(formData.get("goalId") ?? ""),
  };
}

/**
 * The refusal an Owner sees when their link does not open the Goal. Deliberate
 * about saying nothing more: the same answer covers a mistyped link, another
 * Owner's Goal and a Goal that has just been deleted.
 */
const NOT_OWNED = "That link does not open this Goal.";

export type WindowSizeState =
  | { status: "idle" }
  | { status: "queued"; size: number }
  | { status: "error"; message: string };

/**
 * Queues a new Window Size. It applies to the next Window: the one filling now
 * keeps the size it started with, because a Report covers exactly the Window
 * it was written for (ADR-0001).
 */
export async function setWindowSizeAction(
  _state: WindowSizeState,
  formData: FormData,
): Promise<WindowSizeState> {
  const { ownerToken, goalId } = credentials(formData);
  const size = Number(formData.get("windowSize"));

  try {
    switch (await setWindowSize(ownerToken, goalId, size)) {
      case "queued":
        // Without this the action's response carries its return value alone
        // and the page keeps showing the old size.
        refresh();
        return { status: "queued", size };
      case "out-of-range":
        return {
          status: "error",
          message: `A Window is between ${MIN_WINDOW_SIZE} and ${MAX_WINDOW_SIZE} Responses.`,
        };
      case "not-owned":
        return { status: "error", message: NOT_OWNED };
    }
  } catch {
    // Deliberately opaque, and the original error is dropped: it was raised on
    // input that carried an Owner Link (ADR-0002).
    return {
      status: "error",
      message: "Something went wrong saving that. Try again.",
    };
  }
}

export type GoalState =
  | { status: "idle" }
  | { status: "error"; message: string };

/**
 * "I got my yes": the Goal stops taking Responses and everything already
 * written stays readable.
 */
export async function closeGoalAction(
  _state: GoalState,
  formData: FormData,
): Promise<GoalState> {
  const { ownerToken, goalId } = credentials(formData);

  try {
    if ((await closeGoal(ownerToken, goalId)) === "not-owned") {
      return { status: "error", message: NOT_OWNED };
    }
  } catch {
    return {
      status: "error",
      message: "Something went wrong closing that Goal. Try again.",
    };
  }

  refresh();
  return { status: "idle" };
}

/**
 * Deletes the Goal and everything under it, then sends the Owner back to their
 * Dashboard — the Goal's own page no longer exists.
 */
export async function deleteGoalAction(
  _state: GoalState,
  formData: FormData,
): Promise<GoalState> {
  const { ownerToken, goalId } = credentials(formData);

  try {
    if ((await deleteGoal(ownerToken, goalId)) === "not-owned") {
      return { status: "error", message: NOT_OWNED };
    }
  } catch {
    return {
      status: "error",
      message: "Something went wrong deleting that Goal. Try again.",
    };
  }

  // Outside the catch: redirect works by throwing, and swallowing that would
  // leave the Owner on the page of a Goal that is gone.
  redirect(`/d/${ownerToken}`);
}
