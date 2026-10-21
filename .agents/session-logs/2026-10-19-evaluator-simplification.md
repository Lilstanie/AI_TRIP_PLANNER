---
date: 2026-10-19
author: Codex
branch: fix/agent-lab-multicity-validation
pr: 449
area: packages/orchestrator
contract-impact: none
---

# Reuse Agent Lab hotel stay evidence parsing

## What changed

- `packages/orchestrator/src/agent-lab/evaluate.ts` now parses hotel dates and stated nights once for single-city and multi-city checks.
- Kept the existing check IDs and pass conditions while removing duplicate parsing and regex logic.

## Why

The review found duplicated hotel evidence parsing across evaluator paths. Sharing the parser reduces drift while retaining separate date-range and night-count checks.

## Validation

- `pnpm --filter @trip/orchestrator test` — 23 files and 280 tests passed.
- `pnpm --filter @trip/orchestrator typecheck` — passed.
- `pnpm turbo run typecheck --filter=@trip/orchestrator` — passed.
- `pnpm exec prettier --write packages/orchestrator/src/agent-lab/evaluate.ts` — passed.
- `CHANNEL=chrome pnpm --filter @trip/web e2e agent-lab-benchmark` — passed in 121s; replay 6/6, 0 browser errors. Artifact: `output/e2e/runner/2026-10-18T16-27-18-531Z.json`.
- `git diff --check` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, and `pnpm format:check-changed origin/main` — passed.

## Notes for the next person

- Await PR #449 CI for the updated head; do not merge without explicit user instruction.
