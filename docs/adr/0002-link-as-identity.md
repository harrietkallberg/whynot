# Possession of a link is the only identity

There are no accounts, passwords, sessions, or verified identities. An Owner
Link is a 128-bit token, and whoever holds it is the Owner of every Goal behind
it; a Response Link is a separate token under a different path prefix, so the two
can never be confused. We considered requiring an email address up front and
rejected it because the product's entire promise is that you can use it in ten
seconds without giving anything up — when2meet has already trained people to
expect a URL to be the whole account.

Email exists only as a recovery channel, offered after a Goal is created and
always skippable. It never gates the main flow.

## Consequences

- Losing an Owner Link means losing access to those Goals. This is stated plainly
  at creation rather than quietly mitigated.
- Owner Link tokens are credentials: they must never appear in logs, analytics,
  referrer headers, or error reports.
- Adding real authentication later is a migration, not a feature flag.
