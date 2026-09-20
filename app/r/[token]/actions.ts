"use server";

import {
  browserHashFor,
  checkResponseLength,
  createResponse,
  MAX_RESPONSE_LENGTH,
  MIN_RESPONSE_LENGTH,
} from "@/lib/responses";

import { claimBrowserToken } from "./browser-cookie";

/**
 * Submitting a Response.
 *
 * The state handed back says only what this Respondent needs to act on. It
 * carries no count, no seq and no "that filled a Window": the Response Link is
 * public, so anything stateful here is a probe an Owner could use to watch
 * their own Goal from the outside (ADR-0003).
 */
export type SubmitResponseState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "closed" }
  | { status: "thanks" };

const THANKS: SubmitResponseState = { status: "thanks" };

const LENGTH_MESSAGES = {
  "too-short": `A few more words, please — at least ${MIN_RESPONSE_LENGTH} characters.`,
  "too-long": `That is longer than ${MAX_RESPONSE_LENGTH} characters. Trim it down.`,
} as const;

export async function submitResponseAction(
  _state: SubmitResponseState,
  formData: FormData,
): Promise<SubmitResponseState> {
  const responseToken = String(formData.get("responseToken") ?? "");
  const body = String(formData.get("body") ?? "");

  // Before the cookie: a visitor who types three characters and gives up
  // should not be left carrying an identity for a year.
  const rejection = checkResponseLength(body);
  if (rejection) {
    return { status: "error", message: LENGTH_MESSAGES[rejection] };
  }

  const browserToken = await claimBrowserToken();

  try {
    const result = await createResponse({
      responseToken,
      body,
      browserHash: browserHashFor(browserToken, responseToken),
    });

    switch (result.status) {
      case "recorded":
        return THANKS;
      // The same screen as a Response that has just landed. This browser has
      // had its say either way, and a different answer here would tell a
      // visitor which of the two happened.
      case "already-responded":
        return THANKS;
      case "closed":
        return { status: "closed" };
      // Unreachable through this form, which checks the bounds above; the
      // seam answers for any caller, so the cases are still handled.
      case "too-short":
      case "too-long":
        return { status: "error", message: LENGTH_MESSAGES[result.status] };
      case "unknown-goal":
        return {
          status: "error",
          message: "That link does not open anything any more.",
        };
    }
  } catch {
    // Deliberately opaque, and the original error is dropped: it was raised on
    // input that carried this browser's token.
    return {
      status: "error",
      message: "Something went wrong sending that. Try again.",
    };
  }
}
