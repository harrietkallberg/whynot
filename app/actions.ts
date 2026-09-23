"use server";

import { headers } from "next/headers";

import { InvalidGoalTitleError } from "@/lib/goal-title";
import { createGoal } from "@/lib/goals";
import { senderFromEnv } from "@/lib/mail";
import { emailOwnerLink } from "@/lib/owner";

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
  | { status: "sent" };

/**
 * Sends the Owner their link. Email is a recovery channel that never gates the
 * main flow (ADR-0002): the Goal already exists by the time this runs, so every
 * failure comes back as a state the form can show and retry, never as a
 * rejection, and leaves the Goal and both links exactly as they were.
 */
export async function emailOwnerLinkAction(
  _state: EmailState,
  formData: FormData,
): Promise<EmailState> {
  const email = String(formData.get("email") ?? "").trim();
  const ownerToken = String(formData.get("ownerToken") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "That does not look like an address." };
  }

  const notSent: EmailState = {
    status: "error",
    message:
      "We could not send that. Your links still work: copy the Owner Link above, or try again.",
  };

  try {
    const result = await emailOwnerLink(
      { ownerToken, email, origin: await requestOrigin() },
      senderFromEnv(),
    );
    return result === "sent" ? { status: "sent" } : notSent;
  } catch {
    // A database failure must not reject the action: the form would then fall
    // through to the framework's error handling instead of the recoverable
    // state it promises, and the Owner's links are unaffected either way. The
    // original error is dropped because it was raised on input that carried a
    // credential and an address (ADR-0002).
    return notSent;
  }
}

/**
 * Where this request reached the app, so the mailed Owner Link points back at
 * the place the Owner is using. Built the way the Goal page builds its
 * Response Link.
 */
async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  if (!host) throw new Error("The request carried no host");
  return `${protocol}://${host}`;
}
