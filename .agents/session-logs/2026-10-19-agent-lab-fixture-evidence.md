---
date: 2026-10-19
author: Codex
branch: fix/agent-lab-multicity-validation
pr: 449
area: packages/orchestrator
contract-impact: none
---

# Align conflicting-preferences hotel fixture evidence

## What changed

- Updated `scenarios.ts` so the conflicting-preferences hotel evidence matches the four-night trip brief.

## Why

The fixture previously stated one night while its dates and cost represented four nights.

## Validation

- `pnpm --filter @trip/orchestrator test` — 23 files, 280 tests passed.
- `pnpm turbo run typecheck --filter=@trip/orchestrator` — passed.
- `CHANNEL=chrome pnpm --filter @trip/web e2e agent-lab-benchmark` — passed in 123s; replay checks 6/6, no browser errors. Artifact: `output/e2e/runner/2026-10-18T17-01-44-658Z.json`.

## Notes for the next person

- Await current-head CI; do not merge without explicit user instruction.
