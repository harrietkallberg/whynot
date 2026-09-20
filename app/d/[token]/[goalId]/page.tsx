import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Cat } from "@/app/cat";
import { CopyButton } from "@/app/copy-button";
import { openGoal, type OpenedGoal } from "@/lib/dashboard";
import { MAX_WINDOW_SIZE, MIN_WINDOW_SIZE } from "@/lib/goals";

import { GoalControls } from "./goal-controls";
import { WindowSizeForm } from "./window-size-form";

/**
 * One Goal, behind its Owner's link: its Reports oldest first, the Response
 * Link to hand out, the Window Size, and the two ways a Goal ends.
 *
 * Reading down the page is the product. A Report covers one Window and is
 * never rewritten (ADR-0001), so the Reports in order are how an Owner sees
 * whether changing their approach changed the nos — which is why they are
 * oldest first and not newest first.
 *
 * Opening this page marks the Goal's Reports read, which settles its Cat from
 * alert to sitting. No time appears anywhere on it (ADR-0003).
 */
export default async function Page({
  params,
}: PageProps<"/d/[token]/[goalId]">) {
  const { token, goalId } = await params;
  const goal = await openGoal(token, goalId);

  if (!goal) notFound();

  return (
    <main>
      <p>
        <a href={`/d/${token}`}>&larr; Your Goals</a>
      </p>

      <h1>{goal.title}</h1>
      <p className="dashboard-goal">
        <Cat catId={goal.catId} pose={goal.pose} />
        <span className="note">
          {goal.responseCount === 1
            ? "1 Response so far"
            : `${goal.responseCount} Responses so far`}
          {goal.closed ? " · closed" : null}
        </span>
      </p>

      <Reports goal={goal} />

      <hr />
      <h2>The Response Link</h2>
      <ResponseLink responseToken={goal.responseToken} closed={goal.closed} />

      {goal.closed ? null : (
        <>
          <hr />
          <h2>Window Size</h2>
          <WindowSizeForm
            ownerToken={token}
            goalId={goal.id}
            windowSize={goal.windowSize}
            nextWindowSize={goal.nextWindowSize}
            minWindowSize={MIN_WINDOW_SIZE}
            maxWindowSize={MAX_WINDOW_SIZE}
          />
        </>
      )}

      <hr />
      <h2>{goal.closed ? "This Goal is closed" : "Got your yes?"}</h2>
      {goal.closed ? (
        <p>
          It takes no more Responses. Everything below the line is still here
          to read.
        </p>
      ) : null}
      <GoalControls
        ownerToken={token}
        goalId={goal.id}
        closed={goal.closed}
      />
    </main>
  );
}

/**
 * The Goal's Reports, oldest Window first, and what the page says when there
 * is not one yet.
 */
function Reports({ goal }: { goal: OpenedGoal }) {
  return (
    <>
      <hr />
      <h2>Reports</h2>

      {goal.reports.map((report) => (
        <article key={report.id} className="report">
          <h3>
            Window {report.windowIndex} · Responses {report.fromSeq} to{" "}
            {report.toSeq}
          </h3>
          <p>{report.body}</p>
        </article>
      ))}

      {goal.reportPending ? (
        <p className="warning">
          A Window has filled and its Report is still being written. Nothing is
          lost — reload in a minute and it will try again.
        </p>
      ) : null}

      {goal.reports.length === 0 && !goal.reportPending ? (
        <p>
          No Reports yet. The first one unlocks once {goal.windowSize}{" "}
          Responses have come in, and it summarises all {goal.windowSize}{" "}
          together — you will never see any single answer on its own.
        </p>
      ) : null}
    </>
  );
}

/**
 * The link an Owner sends to people who said no, in full and ready to copy.
 * Building it from the request's own host keeps it right wherever the app is
 * running, without any absolute URL being configured.
 */
async function ResponseLink({
  responseToken,
  closed,
}: {
  responseToken: string;
  closed: boolean;
}) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const path = `/r/${responseToken}`;
  const responseLink = host ? `${protocol}://${host}${path}` : path;

  return (
    <>
      <p className="link-box">{responseLink}</p>
      <CopyButton label="Copy the Response Link" value={responseLink} />
      <p className="note">
        {closed
          ? "It still opens, and says this Goal is closed."
          : "It shows this Goal's name and one box. Send it to anyone who turned you down."}
      </p>
    </>
  );
}
