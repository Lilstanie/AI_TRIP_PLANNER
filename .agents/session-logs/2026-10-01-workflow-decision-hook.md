---
date: 2026-10-01
author: Claude
branch: feature/workflow-decision-hook
pr: none
area: packages/orchestrator, docs
contract-impact: none
---

# Report the planning loop's decisions through an optional hook

## What changed

- Added `OrchestratorOptions.onDecision` and the `WorkflowDecision` / `StopReason` types in
  `packages/orchestrator/src/decisions.ts`, called from `workflow.ts` for conflicts detected, revision
  started, revision scored and loop stopped.
- Added `tests/workflow-decisions.test.ts`, with its failure inventory written before the hook.
- Documented the hook in the orchestrator README and the English and Chinese architecture pages.

## Why

Agent Lab (#102) needs the loop's decisions as facts. Progress events describe a run in prose, and the
intermediate scores only exist inside the graph, so parsing them would break on the next rewording.

## Validation

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm verify:docs`, `pnpm verify:protected`: see the PR.
- The hook never changes the plan: a test compares the plan with and without it, and another shows a
  throwing consumer does not lose the plan. Existing `workflow.test.ts` still passes unchanged.

## Notes for the next person

The score is computed only when a consumer is listening. Nothing consumes the hook yet; the lab
strategy that does lands in the next change.
