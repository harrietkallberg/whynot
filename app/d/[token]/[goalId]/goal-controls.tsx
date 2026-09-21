"use client";

import { useActionState, type ReactNode } from "react";

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
  /** A Goal can only be closed once, so the button goes when it has been. */
  closed: boolean;
}) {
  return (
    <>
      {closed ? null : (
        <GoalForm
          action={closeGoalAction}
          ownerToken={ownerToken}
          goalId={goalId}
          label="I got my yes"
          pendingLabel="Closing..."
        >
          <p className="note">
            The Response Link stops taking Responses and says the Goal is
            closed. Everything already written stays here to read.
          </p>
        </GoalForm>
      )}

      <details className="goal-danger">
        <summary>Delete this Goal</summary>
        <GoalForm
          action={deleteGoalAction}
          ownerToken={ownerToken}
          goalId={goalId}
          label="Delete it for good"
          pendingLabel="Deleting..."
        >
          <p className="warning">
            This removes the Goal, every Response it collected and every Report
            written from them. The Response Link stops opening anything. There
            is no undo.
          </p>
        </GoalForm>
      </details>
    </>
  );
}

/**
 * One button that does one thing to this Goal, with what it does written
 * above it. Both endings hand the Owner Link to the server, where it is
 * checked: the button being on screen is not what decides who may press it.
 */
function GoalForm({
  action,
  ownerToken,
  goalId,
  label,
  pendingLabel,
  children,
}: {
  action: (state: GoalState, formData: FormData) => Promise<GoalState>;
  ownerToken: string;
  goalId: string;
  label: string;
  pendingLabel: string;
  /** What this ending does, said before the button that does it. */
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<GoalState, FormData>(
    action,
    { status: "idle" },
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="ownerToken" value={ownerToken} />
      <input type="hidden" name="goalId" value={goalId} />
      {children}
      <button type="submit" disabled={pending}>
        {pending ? pendingLabel : label}
      </button>
      {state.status === "error" ? (
        <p className="error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
