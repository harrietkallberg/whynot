import { notFound } from "next/navigation";

import { findGoalByResponseToken } from "@/lib/goals";

/**
 * The Response Link. A stub: the Response form itself is issue #3. What is
 * real here is the boundary — the page shows the Goal's name and nothing else,
 * so a Respondent learns nothing about the Owner or about other Responses.
 */
export default async function Page({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const goal = await findGoalByResponseToken(token);

  if (!goal) notFound();

  return (
    <main>
      <h1>Why not?</h1>
      <p>Someone asked you to say yes to:</p>
      <p className="link-box">{goal.title}</p>
      <hr />
      <p>The Response form is not built yet.</p>
      <p className="note">
        When it is, your Response will be anonymous: the Owner never sees your
        words, and never sees when you sent them.
      </p>
    </main>
  );
}
