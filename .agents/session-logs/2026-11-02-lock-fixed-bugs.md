---
date: 2026-11-02
author: Claude Code (for Joey)
branch: chore/TP-283-check-per-fix
pr: none
area: apps/web, packages/shared, docs, .agents
contract-impact: packages/shared
---

# Every bug fix now adds a machine check; first batch of checks

## What changed

- `AGENTS.md`, `docs/development.md` § Lock a fixed bug (+ zh), `trip-planner-pr-delivery` and
  `review-trip-planner`: a bug fix adds a lint rule, type, verify script or deletion that fails on
  the old code, with the red output in Evidence.
- `apps/web/.eslintrc.json` bans `window.confirm`, `alert` and `prompt`. Chat sends, question
  answers, resumed runs and retries no longer confirm; `run()` lost its `replacementConfirmed`
  flag. The form replan confirm stays as the one disabled line.
- `settlePlan` takes `write: "traveller" | "background"`; `trip-edit.ts` passes `background` for
  route checks instead of resetting `editVersion` afterwards.
- `moneyIn` removed from `packages/shared/src/money.ts` with its test.
- Agent Note: `.agents/notes/implemented/process/2026-11-02-lock-fixed-bugs.md`.

## Why

Idea from tibo.dog (@poteto): every fixed bug becomes a lint rule. Checked against our fix diffs,
lint alone would have missed TP-247 and the map lifecycle bugs, so types and deletions count too.
Joey chose to keep the form replan confirm: it discards direct edits and has no Undo yet.

## Validation

- `pnpm --filter @trip/web lint` before the exception: `155:12 Error: 'window.confirm' is
  restricted` (rule fires); after: no errors.
- `tsc --noEmit` with an old-style `settlePlan(next, version, currency)`: `TS2554: Expected 4
  arguments, but got 3`; restored: clean.
- `pnpm --filter @trip/web test`: 60 files, 663 passed. `pnpm --filter @trip/shared test`: 56 passed.

## Notes for the next person

- The form replan confirm should become an Undo; then delete the disable line.
