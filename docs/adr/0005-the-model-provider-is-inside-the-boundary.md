# Generating a Report sends Response text to a model provider

ADR-0003 says Owners never see raw Response text, which can be read as a
promise that the text never leaves WhyNot. It does. Generating a Report sends
the whole Window — every word of it — through Vercel's AI Gateway to whichever
model provider serves the request. The promise was always about the Owner, who
is the person a Respondent is protected from; it was never a claim that no
third party processes the words.

We record this because a reader of ADR-0003 alone would conclude the opposite,
and because it constrains what we may tell Respondents. Vercel's Zero Data
Retention — routing only to providers who have agreed not to retain or train on
prompt data — is available on Pro and Enterprise plans, and we are on the free
tier. We decided against paying for a plan to obtain it, on the grounds that
the anonymity that matters here is anonymity from the Owner.

## Consequences

- The sentence shown to Respondents says the answer is summarised by an AI
  model and never shown on its own. It must not claim anything about retention
  or training, because we cannot enforce it.
- Nothing may log the prompt, the generator's error object, or anything else
  carrying Response text. This has already been the source of two defects; it
  is the failure mode to watch on every path that touches a Response.
- If ZDR later matters more than the plan costs, this is the decision to
  revisit — not ADR-0003, which is unchanged.
