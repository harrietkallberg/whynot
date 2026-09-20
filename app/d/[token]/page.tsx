import Link from "next/link";
import { notFound } from "next/navigation";

import { findGoalsByOwnerToken } from "@/lib/goals";
import { resolveOwner } from "@/lib/owner";

/**
 * The Dashboard behind an Owner Link. A stub: the real one, with the Cat's
 * Poses and the Reports, is issue #5. It lists the Goals so an Owner can see
 * that a second Goal made in the same browser landed here too.
 */
export default async function Page({ params }: PageProps<"/d/[token]">) {
  const { token } = await params;

  if (!(await resolveOwner(token))) notFound();

  const goals = await findGoalsByOwnerToken(token);

  return (
    <main>
      <h1>Your Goals</h1>
      <p className="note">
        You are here because you hold this link. Keep it: it cannot be
        recovered.
      </p>

      {goals.length === 0 ? (
        <p>
          No Goals yet. <Link href="/">Create one</Link>.
        </p>
      ) : (
        <ul className="goal-list">
          {goals.map((goal) => (
            <li key={goal.id}>
              {goal.title}
              <br />
              <span className="note">
                Response Link: /r/{goal.responseToken}
              </span>
            </li>
          ))}
        </ul>
      )}

      <hr />
      <p>
        The full Dashboard is not built yet.{" "}
        <Link href="/">Create another Goal</Link>.
      </p>
    </main>
  );
}
