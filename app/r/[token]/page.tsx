import { notFound } from "next/navigation";

import { findGoalByResponseToken } from "@/lib/goals";
import {
  browserHashFor,
  findResponseFormState,
  MAX_RESPONSE_LENGTH,
  MIN_RESPONSE_LENGTH,
} from "@/lib/responses";

import { readBrowserToken } from "./browser-cookie";
import { CLOSED_HEADLINE } from "./copy";
import { ResponseForm } from "./response-form";

/**
 * The Response Link: the Goal's name, one question, one box.
 *
 * Everything an Owner can see stays on the Owner's side of the line — no owner
 * name, no Response count, no progress towards a Window, no other Responses
 * (ADR-0003). The only thing this page will tell a visitor about the Goal
 * beyond its name is whether it is still open, which is the difference between
 * a form that works and one that wastes their time.
 */
export default async function Page({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const goal = await findGoalByResponseToken(token);

  if (!goal) notFound();

  const browserToken = await readBrowserToken();
  const state = await findResponseFormState({
    goalId: goal.id,
    browserHash:
      browserToken === null ? null : browserHashFor(browserToken, token),
  });

  if (state === "closed") {
    return (
      <main>
        <h1>{CLOSED_HEADLINE}</h1>
        <p>Someone had asked you to say yes to:</p>
        <p className="link-box">{goal.title}</p>
        <p className="note">No more answers are being collected for it.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Why not?</h1>
      <p>Someone asked you to say yes to:</p>
      <p className="link-box">{goal.title}</p>
      <ResponseForm
        responseToken={token}
        minLength={MIN_RESPONSE_LENGTH}
        maxLength={MAX_RESPONSE_LENGTH}
        alreadyResponded={state === "already-responded"}
      />
    </main>
  );
}
