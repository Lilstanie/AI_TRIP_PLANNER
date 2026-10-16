---
date: 2026-10-16
author: Claude Haiku 5.5 (interactive, retro follow-up)
branch: chore/e2e-environment-guardrails
pr: pending
area: apps/web, scripts, .github, .githooks
contract-impact: none
---

# Guardrails from the triage-run retro

## What changed

- `apps/web/tests/e2e/legacy-runner.mjs`: the runner clears the Clerk keys for its own server and fails with a clear message if `/` redirects to `/sign-in`.
- `scripts/check-e2e-artifacts.mjs` plus `pnpm verify:e2e-artifacts` and a CI step: fails when an E2E script writes no artifact.
- `apps/web/tests/e2e/support/e2e-helpers.mjs`: shared trip-button, example-chip and budget-chip locators, and `normalizeText`. `budget-amount-limit.e2e.mjs` uses them.
- `.githooks/pre-push`: runs `pnpm --filter @trip/web typecheck` when the branch touches `apps/web/`.

## Why

Each change answers a finding from the triage run: the Clerk redirect cost four failed runs, the artifact rule was caught only by review, guessed locators and a literal space in money text each cost a run, and CI was the first place type errors appeared.

## Validation

- `node tests/e2e/run.mjs budget-amount-limit` without manual Clerk overrides: 6/6 checks passed.
- `pnpm verify:e2e-artifacts`: all 54 E2E scripts write an artifact.
- `pnpm verify:e2e-selectors`, `pnpm verify:protected`, `pnpm format:check-changed origin/main`: pass.
- `pnpm --filter @trip/web typecheck`: exit 0. `pnpm --filter @trip/web lint`: no errors.
- Not exercised: the sign-in redirect guard, because no run hit a redirect. The pre-push typecheck runs on the next push.

## Notes for the next person

- Protected files touched with the user's explicit approval: root `package.json` (one script line) and `.github/workflows/ci.yml` (one step).
- The artifact check looks for `writeFileSync`, `writeFile` or `screenshot`; a script that writes artifacts another way will fail and needs the pattern extended.
- The global `~/.claude/CLAUDE.md` merge exception and environment notes live outside the repo.
