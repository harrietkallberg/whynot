import { LANDING_LINE } from "./copy";
import { CreateGoalForm } from "./create-goal-form";

export default function Page() {
  return (
    <main>
      <h1>WhyNot</h1>
      <p className="tagline">{LANDING_LINE}</p>
      <CreateGoalForm />
    </main>
  );
}
