# Handoff: the remaining backlog

Written 2026-09-23, at `a50392f` on `dev`, for the session that will orchestrate
agents through the rest of the open issues. It records what the last session
established and what an orchestrator has to know before dispatching anyone. It
is a snapshot, not a standing document: delete it once the backlog it describes
is gone.

## Start here

You are orchestrating, not implementing. Before dispatching anybody:

1. Read `CLAUDE.md` and `AGENTS.md`, then `CONTEXT.md` and all five ADRs in
   `docs/adr/`. Most of the traps below are ADR consequences, and an agent that
   has not read them will breach one while writing correct-looking code.
2. Read the issue you are about to dispatch in full —
   `gh issue view <n> --comments`. The bodies are specifications, not summaries,
   and several of them say explicitly what *not* to do.
3. Give each agent: its issue number, the standing constraints below, and its
   own worktree with `.env.test.local` copied in and pointed at its own Neon
   test branch. An agent that starts without that file fails every database
   test for a reason that looks nothing like the cause.
4. Require `npm test`, `npm run typecheck` and `npm run lint` of each agent
   before it opens a PR. PRs target `dev`. Close the issue by hand after merge.

Do not let an agent widen its issue. #8 in particular is a decision session with
the human and is not to be dispatched at all.

## Where the repo stands

`dev` is the integration branch and everything real is on it. `main` is well
behind and is not deployed anywhere — the app has never been deployed at all.
The working tree is clean apart from two untracked `pixil-frame-*.png` files in
the root, which are cat-sprite scratch and belong either in `scripts/` input or
in the bin.

The last two commits are documentation, not code. `1678f2e` added the Archived,
Discarded and Unread terms to the glossary; `a50392f` then reversed the
thirty-day grace period decided an hour earlier, so **deleting a Goal is now
immediate and archiving is the recoverable path**. ADR-0004 is the current word
on this. Nothing in the code has caught up yet — see #14, and the vocabulary
note below.

## Credentials, which gate two issues

`.env.local` (gitignored, never committed) now holds `DATABASE_URL`,
`DATABASE_URL_UNPOOLED`, `NEON_BRANCH` and, as of this session,
`AI_GATEWAY_API_KEY` and `RESEND_API_KEY`. The Vercel account exists, which
unblocks #18. **Every credential the backlog needs is now in place** — no issue
is waiting on a secret.

What is still outstanding for #17 is not a credential but a **verified sending
domain**. Resend's default `onboarding@resend.dev` sender delivers only to the
address on the Resend account and returns 403 for anybody else.

**This is a known and accepted limit for now, not a blocker.** The decision on
2026-09-23 was to build and verify #17 end to end against the account owner's
own inbox and leave the domain until the deployment needs one anyway (#18).
Dispatch the issue. What that means in practice: the agent tests with the
Resend account's own address as recipient, and #17 is not closed as *delivering*
until a domain is verified — its Done-when carries a box saying exactly that.

## Dispatch order

The two constraints that shape this are file overlap and the fact that #13 is
the only issue standing between the app and being a product.

**Wave 1 — three agents in parallel, no shared files.**

- **#13, the Report generator.** The highest-value issue: Reports are the one
  feature that cannot produce output, and everything else already runs. Touches
  `lib/reports.ts` and `package.json` only.
- **#16, landing line and the Respondent's promise.** Touches `app/page.tsx`
  and `app/r/[token]/copy.ts`. Small, isolated, and safe beside anything.
- **#17, send the Owner Link by email.** Touches `app/actions.ts`,
  `lib/owner.ts`, a new mail module and `package.json`. Ready to dispatch: the
  transport was changed from Gmail SMTP to Resend on 2026-09-23 and the issue
  body was rewritten to match, so an agent reading it will not build Gmail.

Note that #13 and #17 both add a dependency, so both edit `package.json` and
`package-lock.json`. That is a guaranteed lockfile conflict if they run in
parallel and a trivial one to resolve — regenerate rather than hand-merge.

**Wave 2 — one agent, sequential.**

- **#14 (confirm before deleting, make archiving hide the Goal)** and **#15
  (say what a Goal is waiting for)** both edit `lib/dashboard.ts` and
  `app/d/[token]/page.tsx`. Give them to one agent in that order, or serialise
  two. Running them in parallel buys nothing and costs a merge.

**Then #18**, deploy and make `main` the product. It wants every environment
variable above, so it genuinely comes last. Its own body asks a question worth
settling while you are in there: whether the Neon `production` branch is really
the one serving the deployment, and what happens to the now-idle `test-reports`
and `test-cats` branches.

**#8 is not for an agent and its own body says so.** It is five open questions
about abuse control, two of which collide with ADR-0003 — a rate limiter is a
counter with a time dimension, and the Response path may not acquire one. That
is a grilling session with the human, not a task. Leave it `needs-triage`.

## What every agent has to be told

These are repo-wide and none of them are obvious from the file being edited.

- **Read `AGENTS.md` first, and mean it.** This is Next.js 16.3.5 with breaking
  changes from training data. The guides in `node_modules/next/dist/docs/` are
  the source of truth for anything framework-shaped.
- **Never log Response text, a prompt, an Owner Link, an address, or a caught
  error object.** ADR-0003 and ADR-0005 both turn on this and it has already
  caused two defects. The pattern to copy is `catchUpReports` in
  `lib/dashboard.ts`: log a fixed diagnostic and the Goal id, and drop the error
  entirely, because no amount of trimming makes a stranger's exception safe to
  print.
- **No timestamps leave `lib/dashboard.ts`.** Counts are fine; times identify a
  Respondent when paired with a known send time.
- **House style is early-2000s plain.** #16 puts it bluntly: no rounded cards,
  no shadows, no transitions, no gradients. It applies to #14 and #15 too.
- **Commits end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`,
  PR bodies with the Claude Code line.** PRs target `dev`.
- **Close issues by hand.** GitHub only honours closing keywords against the
  default branch, and the default branch is `dev` while PRs merge into it — this
  is precisely what #18 fixes. Until then, `gh issue close <n> --comment "..."`.

## Test and worktree mechanics

`npm test` is Vitest; `npm run typecheck` and `npm run lint` exist and are worth
requiring of each agent before it opens a PR.

Two things about the database will bite an orchestrator specifically:

- **`.env.test.local` is gitignored, so a fresh worktree does not have it.** An
  agent working in `.claude/worktrees/<id>` starts with no test database and
  every database test fails on a missing `DATABASE_URL` — which `vitest.setup.ts`
  makes deliberately loud rather than letting it fall back to another branch.
  Copy the file into each worktree as part of setting the agent up.
- **Parallel agents should not share one Neon test branch.** That is what the
  `test-reports` and `test-cats` branches were for last time. Tests do clean up
  the rows they create, scoped to the Owner they minted, so the collision window
  is small — but it is not zero, and a flaky suite will cost more to diagnose
  than a branch costs to make. One branch per parallel agent, pointed at by that
  worktree's `.env.test.local`.

Stale local branches are lying around from the last run — `worktree-agent-*`
(five of them), plus `dashboard`, `report-generation`, `response-form`, `cats`,
`goal-creation` and `verify-dev`. `git worktree list` shows only the main
checkout, so the worktrees themselves are already gone. Pruning these is a
two-minute job that will make the next run legible.

## Per-issue notes worth carrying over

**#13, the Report generator.** The seam is already right and does not need to
change: `generateReportWithModel` in `lib/reports.ts` is a single function that
throws on purpose, and its only caller already catches, leaves the Window owed
and retries on the next read. `REPORT_MODEL` is still the bare string
`"claude-haiku-4-5"`, which is *not* a gateway model id — the gateway wants
`provider/model` form. The `ai` package is not installed.

**The model has been chosen: `alibaba/qwen3.8-omni-flash`**, confirmed present
in the live list at `https://ai-gateway.vercel.sh/v1/models` on 2026-09-23, at
$0.15/M input and $0.47/M output — about $0.0002 a Report, a tenth of the Haiku
estimate the issue worked from. Set `REPORT_MODEL` to it.

Two caveats travel with that choice. `alibaba/qwen3.8-flash` is the identically
priced text-only sibling, so the omni variant is carrying modalities this task
never sends; switching is free if anyone wants to. More importantly, #13 warns
that a weaker model is likelier to quote, attribute or invent a headcount, and
a flash-tier model is that case — **the adversarial fixtures have to be run
against it for real before this ships**, and a fallback model should be in mind
if it quotes. The model is chosen by whether it obeys ADR-0003, not by price — and those fixtures currently run against
injected fakes, so checking a real model means a script that reads `.env.local`,
never a test in the suite. `.env.test.local` must stay free of model
credentials.

**#14, and a vocabulary drift to settle.** CONTEXT.md and ADR-0004 now say
*Archived*. The code says `closed`, `closedAt` and "they got their yes"
throughout `app/d/[token]/[goalId]/` and `app/r/[token]/copy.ts`. #14 is the
issue that touches all of it, so it is the place to decide whether to rename —
but decide deliberately, because a rename widens the diff into the Respondent's
side and `CLOSED_HEADLINE` is copy a Respondent reads. The issue also flags that
a native `window.confirm()` blocks browser automation outright, which matters if
anyone smoke-tests the app in a real browser afterwards.

**#15** must read the Window Size off the Goal rather than assuming three, and
must leave the Respondent's side untouched — the thank-you page deliberately
says nothing about a Goal's state, because an Owner could otherwise read their
own Goal's progress from the Respondent side. It also has to render sensibly for
a Window that has filled but whose Report has not generated, which is exactly
the state #13 failing produces. If #13 lands first, that case is easier to see.

**#17** stores addresses today and sends nothing, which the issue rightly calls
the worst of both states. `setOwnerEmail` in `lib/owner.ts` is the capture path
and its comment already names the gap. Email must never gate Goal creation, and
a send failure has to return a recoverable state rather than surface as a
failure to create.

## The product step nobody has done

#18 ends with the thing most worth protecting: this is an app about feedback
loops that has never been through one. Before it is findable, deploy to a
preview URL, use it on a real goal, and send the Response Link to three people
who actually turned you down. No agent can do that, and no amount of backlog
clearing substitutes for it.
