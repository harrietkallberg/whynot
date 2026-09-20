"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

import { submitResponseAction, type SubmitResponseState } from "./actions";
import { ANONYMITY_PROMISE, CLOSED_HEADLINE } from "./copy";
import {
  hasRespondedLocally,
  hasRespondedOnServer,
  rememberRespondedLocally,
  subscribeToRespondedLocally,
} from "./responded-storage";

/**
 * One textarea and one question. Nothing on this side of the link may show a
 * count, a Window, a Report or another Response (ADR-0003), so this component
 * is given the Goal's name, the length bounds, and nothing else to render.
 */
export function ResponseForm({
  responseToken,
  minLength,
  maxLength,
  alreadyResponded,
}: {
  responseToken: string;
  minLength: number;
  maxLength: number;
  /** This browser's guard row was already there when the page was drawn. */
  alreadyResponded: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    SubmitResponseState,
    FormData
  >(async (previous, formData) => {
    const next = await submitResponseAction(previous, formData);
    if (next.status === "thanks") rememberRespondedLocally(responseToken);
    return next;
  }, { status: "idle" });

  /**
   * The server has no localStorage, so it renders as if this browser had not
   * answered and the note is applied once the page is live.
   */
  const respondedLocally = useSyncExternalStore(
    subscribeToRespondedLocally,
    () => hasRespondedLocally(responseToken),
    hasRespondedOnServer,
  );

  /**
   * Held here rather than left to the DOM: React resets a form once its
   * action returns, and a Respondent whose answer came back too short should
   * find their words still in the box.
   */
  const [body, setBody] = useState("");

  if (state.status === "thanks" || alreadyResponded || respondedLocally) {
    return <Thanks />;
  }

  if (state.status === "closed") {
    return (
      <>
        <h2>{CLOSED_HEADLINE}</h2>
        <p>It closed while you were writing, so your answer was not sent.</p>
      </>
    );
  }

  return (
    <form action={formAction}>
      <label htmlFor="body">Why not?</label>
      <textarea
        id="body"
        name="body"
        rows={8}
        minLength={minLength}
        /*
         * The attribute counts UTF-16 code units, the bound counts
         * characters, and a character can be two code units. Doubling it
         * keeps the box from cutting a legal answer short; the server is
         * what actually holds the line at maxLength.
         */
        maxLength={maxLength * 2}
        required
        autoFocus
        disabled={pending}
        placeholder="The real reason, in your own words."
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <input type="hidden" name="responseToken" value={responseToken} />
      <p className="note">
        {/* Counted the way the server counts: trimmed, and in characters
            rather than UTF-16 halves, so an answer written in emoji reads
            the same here as it measures there. */}
        {[...body.trim()].length} of {maxLength} characters. At least{" "}
        {minLength}.
      </p>
      <p className="note">{ANONYMITY_PROMISE}</p>
      <button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Send it"}
      </button>
      {state.status === "error" ? (
        <p className="error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * The whole of what a Respondent gets back. No count, no "that unlocked a
 * Report", no way to edit: every one of those would report the Goal's state to
 * anyone holding the Response Link, including its Owner (ADR-0003).
 */
function Thanks() {
  return (
    <>
      <h2>Thank you.</h2>
      <p>That is everything. You can close this page.</p>
      <p className="note">{ANONYMITY_PROMISE}</p>
    </>
  );
}
