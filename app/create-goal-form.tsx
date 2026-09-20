"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

import {
  createGoalAction,
  rememberEmailAction,
  type CreateGoalState,
  type EmailState,
} from "./actions";
import {
  getOwnerToken,
  getServerOwnerToken,
  rememberOwnerToken,
  subscribeToOwnerToken,
} from "@/lib/owner-link-storage";

/**
 * The whole create flow: one text field, then the two links. The Owner Link is
 * held in component state and in localStorage only — never in the URL, never
 * in a log (ADR-0002).
 */
export function CreateGoalForm() {
  /**
   * The server action runs behind this wrapper so the new Owner Link is in
   * localStorage by the time it is on screen.
   */
  const [state, formAction, pending] = useActionState<
    CreateGoalState,
    FormData
  >(async (previous, formData) => {
    const next = await createGoalAction(previous, formData);
    if (next.status === "created") rememberOwnerToken(next.ownerToken);
    return next;
  }, { status: "idle" });

  const storedOwnerToken = useSyncExternalStore(
    subscribeToOwnerToken,
    getOwnerToken,
    getServerOwnerToken,
  );

  // Read lazily: the links that need it are only rendered after the browser
  // has submitted the form, so this never runs during server rendering.
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );

  const dashboardHref =
    storedOwnerToken === null ? null : `/d/${storedOwnerToken}`;

  return (
    <>
      <h1>WhyNot</h1>
      <p className="tagline">
        Every yes is preceded by a pile of nos. Collect the reasons, anonymously.
      </p>

      {dashboardHref !== null && state.status !== "created" ? (
        <p>
          This browser already holds an Owner Link.{" "}
          <a href={dashboardHref}>Open your Dashboard</a>.
        </p>
      ) : null}

      <hr />

      <form action={formAction}>
        <label htmlFor="title">What do you want someone to say yes to?</label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={140}
          required
          autoFocus
          autoComplete="off"
          placeholder="Play the Wigmore Hall"
          disabled={pending}
        />
        {storedOwnerToken !== null ? (
          <input type="hidden" name="ownerToken" value={storedOwnerToken} />
        ) : null}
        <p className="note">
          Press enter. Your Goal&apos;s name is shown to everyone who opens the
          Response Link, so keep anything private out of it.
        </p>
        <button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create the Goal"}
        </button>
      </form>

      {state.status === "error" ? (
        <p className="error" role="alert">
          {state.message}
        </p>
      ) : null}

      {state.status === "created" ? (
        <CreatedGoal origin={origin} state={state} />
      ) : null}
    </>
  );
}

function CreatedGoal({
  origin,
  state,
}: {
  origin: string;
  state: Extract<CreateGoalState, { status: "created" }>;
}) {
  const responseLink = `${origin}/r/${state.responseToken}`;
  const ownerLink = `${origin}/d/${state.ownerToken}`;

  return (
    <>
      <hr />
      <h2>{state.title}</h2>

      <h2>Response Link — send this to people who said no</h2>
      <p className="link-box">{responseLink}</p>
      <CopyButton label="Copy the Response Link" value={responseLink} />
      <p className="note">
        It opens the Response form and shows the Goal&apos;s name. Nothing else.
      </p>

      <h2>Owner Link — keep this one</h2>
      <p className="link-box">{ownerLink}</p>
      <CopyButton label="Copy the Owner Link" value={ownerLink} />
      <p className="warning">
        This link is the only way back to your Dashboard. There is no account
        and no password, so if you lose it, it cannot be recovered and these
        Goals are gone. Save it somewhere now.
      </p>
      <p>
        <a href={ownerLink}>Go to your Dashboard</a>
      </p>

      <EmailBox ownerToken={state.ownerToken} />
    </>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {label}
      </button>{" "}
      {copied ? <span>Copied.</span> : null}
    </p>
  );
}

function EmailBox({ ownerToken }: { ownerToken: string }) {
  const [state, formAction, pending] = useActionState<EmailState, FormData>(
    rememberEmailAction,
    { status: "idle" },
  );

  if (state.status === "saved") {
    return (
      <>
        <hr />
        <p>
          Address saved. Nothing is sent yet — we have not picked a mail
          provider — so keep the link above as well.
        </p>
      </>
    );
  }

  return (
    <>
      <hr />
      <form action={formAction}>
        <label htmlFor="email">Email me this link (optional)</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={pending}
        />
        <input type="hidden" name="ownerToken" value={ownerToken} />
        <p className="note">
          Skipping this is the normal path. Your links work either way.
        </p>
        <button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save my address"}
        </button>
        {state.status === "error" ? (
          <p className="error" role="alert">
            {state.message}
          </p>
        ) : null}
      </form>
    </>
  );
}
