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
(`DATABASE_URL`, `DATABASE_URL_UNPOOLED`); `vitest.setup.ts` loads that file and
lets nothing else supply those variables, so a run can never reach the branch
the app deploys from. Without the file, the tests that need a database fail and
the rest still run. Tests delete the rows they create, so the suite is
repeatable.

## Framework

@AGENTS.md
