# Reports cover a fixed Window and are never regenerated

A Report summarises exactly the Responses in one Window — three by default, up to
thirty — and is written once, at the moment that Window fills. It is never
rewritten, and it never widens to include Responses that arrived later. The
obvious alternative was to regenerate a single living summary over all Responses
to date, which we rejected because it destroys the thing the product exists for:
an Owner wants to know whether *changing their approach changed the nos*, and a
cumulative summary averages exactly that signal away. A sequence of fixed
snapshots read top to bottom is the answer, so the archive is the feature.

## Consequences

- Reports are immutable rows. Nothing in the system may update one, including a
  later change to the Goal's Window Size.
- Changing the Window Size applies to the next Window only. The Window currently
  filling keeps the size it started with, so no Report ever covers a count that
  matches no setting that ever existed.
- Improving the generation prompt does not improve old Reports, by design. Tune
  prompts against seeded data, not by backfilling history.
