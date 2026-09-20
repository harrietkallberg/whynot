"use server";

import { createGoal, InvalidGoalTitleError } from "@/lib/goals";
import { setOwnerEmail } from "@/lib/owner";

/**
 * Nothing in this file logs a token or puts one in an error message: an Owner
 * Link is a credential (ADR-0002) and these functions are the only place one
 * is minted or read on the server.
 */

export type CreateGoalState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "created";
      title: string;
      ownerToken: string;
      responseToken: string;
    };

export async function createGoalAction(
  _state: CreateGoalState,
  formData: FormData,
): Promise<CreateGoalState> {
  const title = String(formData.get("title") ?? "");
  const ownerTokenField = formData.get("ownerToken");
  const ownerToken =
    typeof ownerTokenField === "string" && ownerTokenField !== ""
      ? ownerTokenField
      : null;

  try {
    const goal = await createGoal({ title, ownerToken });

    return {
      status: "created",
      title: goal.title,
      ownerToken: goal.ownerToken,
      responseToken: goal.responseToken,
    };
  } catch (error) {
    if (error instanceof InvalidGoalTitleError) {
      return { status: "error", message: error.message };
    }

    // Deliberately opaque: the caller's input included a credential, so no
    // part of the original error is passed on.
    return {
      status: "error",
      message: "Something went wrong creating that Goal. Try again.",
    };
  }
}

export type EmailState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved" };

/**
 * Records the address, and sends nothing: no mail provider has been chosen.
 * Email is a recovery channel that never gates the main flow (ADR-0002), so a
 * failure here leaves the Goal, and both links, exactly as they were.
 */
export async function rememberEmailAction(
  _state: EmailState,
  formData: FormData,
): Promise<EmailState> {
  const email = String(formData.get("email") ?? "").trim();
  const ownerToken = String(formData.get("ownerToken") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "That does not look like an address." };
  }

  const saved = await setOwnerEmail(ownerToken, email);
  if (!saved) {
    return {
      status: "error",
      message: "We could not save that address. Your links still work.",
    };
  }

  return { status: "saved" };
}
