"use client";

import { useActionState } from "react";

import { setWindowSizeAction, type WindowSizeState } from "../actions";

/**
 * The Window Size control: how many Responses this Goal collects before each
 * Report.
 *
 * A change applies to the next Window. The one filling now keeps the size it
 * started with, so the form says that rather than leaving an Owner to wonder
 * why the number they typed has not taken effect yet (ADR-0001).
 */
export function WindowSizeForm({
  ownerToken,
  goalId,
  windowSize,
  nextWindowSize,
  minWindowSize,
  maxWindowSize,
  closed,
}: {
  ownerToken: string;
  goalId: string;
  windowSize: number;
  nextWindowSize: number | null;
  minWindowSize: number;
  maxWindowSize: number;
  /** The Goal takes no more Responses, so no further Window will fill. */
  closed: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    WindowSizeState,
    FormData
  >(setWindowSizeAction, { status: "idle" });

  return (
    <form action={formAction}>
      <label htmlFor="windowSize">
        Responses per Report, {minWindowSize} to {maxWindowSize}
      </label>
      <input
        className="window-size"
        id="windowSize"
        name="windowSize"
        type="number"
        min={minWindowSize}
        max={maxWindowSize}
        step={1}
        required
        disabled={pending}
        defaultValue={nextWindowSize ?? windowSize}
      />
      <input type="hidden" name="ownerToken" value={ownerToken} />
      <input type="hidden" name="goalId" value={goalId} />
      <p className="note">
        {closed
          ? `This Goal is closed, so nothing more will arrive to fill a Window. The last one ran at ${windowSize}.`
          : `The Window filling now stays at ${windowSize}, whatever you choose here. A Report covers exactly the Window it was written for, so a new size starts with the next one.`}
      </p>
      <button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save the Window Size"}
      </button>
      {state.status === "queued" ? (
        <p>The next Window will be {state.size} Responses.</p>
      ) : null}
      {state.status === "error" ? (
        <p className="error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
