---
date: 2026-10-06
author: Claude Code
branch: refactor/money-cleanup
pr: none
area: apps/web, docs
contract-impact: none
---

# Agent Lab and the planner sentence use the Money module; lint rejects toFixed(2) (#203)

## What changed

- `apps/web/lib/money.ts`: `moneyDisplay` gains `symbol` (international symbol against the
  number, `A$3,960`); new `plannerAud()` for the sentence sent to the planner (English AUD with
  cents, independent of language and display currency).
- Agent Lab: `lib/agent-lab/format.ts` deleted; `lib/agent-lab/money.ts` exports `labMoney`
  (fixed AUD, whole dollars, symbol). The conflict trace's saving target in `event-copy.ts` uses it
  instead of `AUD x.toFixed(2)`.
- `lib/workspace/workspace.ts`: `money` and `budgetHint` deleted; the unused `tripFacts` in
  `components/workspace/workspace-helpers.ts` deleted; `useWorkspaceTransport` uses `plannerAud`.
- `apps/web/.eslintrc.json`: `no-restricted-syntax` rejects `.toFixed(2)`.
- Docs: Money paragraph in `docs/workspace-ui.md` and its Chinese pair; `better-writing` skill.

## Why

The ticket requires the Agent Lab E2E scripts to pass unchanged, and they expect `A$3,960`. The
Money module shows codes (`AUD 3,960`), so the symbol is an option rather than a second formatter.
The planner sentence keeps its exact old text (`AUD 2,000.00`) so planner prompts do not shift.

## Validation

- `pnpm --filter @trip/web lint`: no warnings or errors; a probe file with `n.toFixed(2)` failed it.
- `pnpm --filter @trip/web typecheck`: passed. `pnpm --filter @trip/web test`: 50 files, 524 tests passed.
- `pnpm verify:docs` and `pnpm verify:protected`: passed.
- Agent Lab E2E against `next dev` (fixture mode): single-agent, comparison, revision, benchmarks,
  failures, replay and release all exit 0.

## Notes for the next person

- `agent-lab-live-gate.e2e.mjs` was not run: it needs three servers with live settings.
- `next lint` only lints `app`, `components`, `lib` and friends, so `tests/e2e` scripts still use
  `.toFixed(2)` in their own assertions; server packages are out of scope (spec #196).
