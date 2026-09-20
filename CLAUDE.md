# whynot

## Agent skills

### Issue tracker

Issues live as GitHub issues in `harrietkallberg/whynot`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using the default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Tests

`npm test` runs Vitest. Tests that touch the database run against the Neon
`test` branch, whose credentials live in the gitignored `.env.test.local`
(`DATABASE_URL`, `DATABASE_URL_UNPOOLED`); `vitest.setup.ts` clears both
variables before reading that file, so an ambient or CI value can never supply
them and a run can never reach the branch the app deploys from. A file that
does not set `DATABASE_URL` stops the run; no file at all leaves the tests that
need a database failing on the missing variable while the rest still run. Tests
delete the rows they create, so the suite is repeatable.

## Framework

@AGENTS.md
