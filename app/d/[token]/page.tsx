import Link from "next/link";
import { notFound } from "next/navigation";

import { Cat } from "@/app/cat";
import { catOfTheDay } from "@/lib/cats";
import { dashboardFor } from "@/lib/dashboard";
import { resolveOwner } from "@/lib/owner";

import { countOfResponses } from "./counts";

/**
 * The Dashboard behind an Owner Link: every Goal this Owner has created, side
 * by side, as a Cat, a name and a count.
 *
 * No time appears anywhere on it — not when a Goal was made, not when a
 * Response arrived, not when a Report was written. A live counter next to a
 * known send time would identify a Respondent without a word of their text
 * (ADR-0003). Counts are shown; times are not.
 *
 * Nothing here signals an individual Response either. The only thing worth
 * announcing is a Report unlocking, and the Cat's Pose is how it is announced.
 */
export default async function Page({ params }: PageProps<"/d/[token]">) {
  const { token } = await params;

  // An Owner Link that belongs to nobody has no Dashboard, which is a
  // different thing from an Owner who has not made a Goal yet.
  if (!(await resolveOwner(token))) notFound();

  const goals = await dashboardFor(token);

  return (
    <main>
      <h1>Your Goals</h1>
      <p className="note">
        You are here because you hold this link. Keep it: there is no account
        behind it and it cannot be recovered.
      </p>

      {goals.length === 0 ? <NoGoalsYet /> : null}

      <ul className="dashboard">
        {goals.map((goal) => (
          <li key={goal.id} className="dashboard-goal">
            <Cat catId={goal.catId} pose={goal.pose} />
            <div>
              {/*
               * A plain link, not a prefetching one: opening a Goal marks its
               * Reports read, so nothing may fetch that page on the chance
               * that the Owner is about to click it.
               */}
              <a href={`/d/${token}/${goal.id}`}>{goal.title}</a>
              <br />
              <span className="note">{countOfResponses(goal.responseCount)}</span>
            </div>
          </li>
        ))}
      </ul>

      <hr />
      <p>
        <Link href="/">Create another Goal</Link>
      </p>
    </main>
  );
}

/** Today's Cat, keeping the page company until there is a Goal on it. */
function NoGoalsYet() {
  return (
    <p className="dashboard-goal">
      <Cat catId={catOfTheDay(new Date())} pose="asleep" />
      <span>
        No Goals yet. <Link href="/">Create one</Link> and its Response Link is
        yours to send to anyone who turns you down.
      </span>
    </p>
  );
}
