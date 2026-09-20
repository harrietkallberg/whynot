# Owners never see Response text, and never see timing

Raw Response text is stored indefinitely but is shown to the Owner never — not
at any Window Size, not through any view or API. The threat we are defending
against is not an Owner being curious, it is an Owner identifying a Respondent
and following up with them directly; the honest answer people give us is only
worth having if it cannot be traced back to them.

We considered unlocking raw text at larger Window Sizes and rejected it: volume
dilutes *counting* attacks but does nothing against *content* attacks, since one
distinctive sentence identifies its author in a pool of thirty just as fast as in
a pool of three.

## Consequences

- Timestamps are withheld everywhere — Dashboard, Reports, API responses — because
  a live counter plus a known send time identifies a Respondent without any text
  at all. Counts are shown; times are not.
- Notifications fire on Report unlock only, never on an individual Response.
- Reports must not quote, paraphrase distinctively, or attribute ("one person
  said"). This is a constraint on the generation prompt, not a nicety.
- Retention is not permission. If authentication later changes what Owners can
  see, that is a new promise to new Respondents, never a retroactive unlock of
  text given under this one.
