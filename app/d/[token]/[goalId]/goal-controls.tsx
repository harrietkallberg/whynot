"use client";

import { useActionState } from "react";

import { closeGoalAction, deleteGoalAction, type GoalState } from "../actions";

/**
 * The two endings a Goal can have.
 *
 * Closing is the happy one: the Owner got their yes, no more Responses are
 * taken, and every Report stays where it is to be read. Deleting is the other
 * one, and it takes the Responses and the Reports with it, so it is folded
 * away behind a second click rather than sitting next to the first.
 */
export function GoalControls({
  ownerToken,
  goalId,
  closed,
}: {
  ownerToken: string;
  goalId: string;
  closed: boolean;
}) {
  return (
    <>
      {closed ? null : <CloseForm ownerToken={ownerToken} goalId={goalId} />}
      <details>
        <summary>Delete this Goal</summary>
        <DeleteForm ownerToken={ownerToken} goalId={goalId} />
      </details>
    </>
  );
}

function CloseForm({
  ownerToken,
  goalId,
}: {
  ownerToken: string;
  goalId: string;
}) {
  const [state, formAction, pending] = useActionState<GoalState, FormData>(
    closeGoalAction,
    { status: "idle" },
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="ownerToken" value={ownerToken} />
      <input type="hidden" name="goalId" value={goalId} />
      <button type="submit" disabled={pending}>
        {pending ? "Closing..." : "I got my yes"}
      </button>
      <p className="note">
        The Response Link stops taking answers and says the Goal is closed.
        Everything already written stays here to read.
      </p>
      {state.status === "error" ? (
        <p className="error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function DeleteForm({
  ownerToken,
  goalId,
}: {
  ownerToken: string;
  goalId: string;
}) {
  const [state, formAction, pending] = useActionState<GoalState, FormData>(
    deleteGoalAction,
    { status: "idle" },
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="ownerToken" value={ownerToken} />
      <input type="hidden" name="goalId" value={goalId} />
      <p className="warning">
        This removes the Goal, every Response it collected and every Report
        written from them. The Response Link stops opening anything. There is
        no undo.
      </p>
      <button type="submit" disabled={pending}>
        {pending ? "Deleting..." : "Delete it for good"}
      </button>
      {state.status === "error" ? (
        <p className="error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
