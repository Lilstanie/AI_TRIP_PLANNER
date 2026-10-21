---
date: 2026-10-19
author: Codex
branch: fix/agent-lab-multicity-validation
pr: 449
area: packages/orchestrator
contract-impact: none
---

# Use one stay-night rule across evaluator paths

## What changed

- `packages/orchestrator/src/agent-lab/evaluate.ts`: require complete date/night evidence and centralize stay-night consistency checks.
- Reuse the same predicate for multi-city stays and single-city trip-day checks.

## Why

The evaluator had duplicate checks that could accept different stay evidence for the same hotel rule.

## Validation

- `pnpm --filter @trip/orchestrator test`: 23 files / 280 tests passed.
- `pnpm turbo run typecheck --filter=@trip/orchestrator`: passed.
- `DATA_MODE=mock CHANNEL=chrome pnpm --filter @trip/web e2e agent-lab-benchmark`: passed in 122s; replay checks passed with no browser errors. Runner: `output/e2e/runner/2026-10-18T18-22-16-964Z.json`.
- `pnpm verify:docs`, `pnpm verify:protected`, Prettier, and `git diff --check`: passed.

## Notes for the next person

- None.
