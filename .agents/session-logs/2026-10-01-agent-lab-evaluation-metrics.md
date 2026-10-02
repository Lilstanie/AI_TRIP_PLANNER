---
date: 2026-10-01
author: Claude
branch: feature/agent-lab-evaluation-metrics
pr: none
area: packages/shared, packages/orchestrator, apps/web, docs
contract-impact: packages/shared
---

# Add recomputable evaluation metrics and the revision trace contract to Agent Lab

## What changed

- `packages/shared/src/agent-lab.ts`: `AgentLabStopReason`, four revision trace events and the metrics
  `groundedSections`, `duplicateStops`, `genericStops`, `multiCityConsistent`, `stopReason` and `usage`.
- `packages/orchestrator/src/agent-lab/metrics.ts`: `measureAgentLabRun` and `recomputeAgentLabMetrics`,
  pure functions of the final plan and the trace; `run.ts` uses them for every strategy.
- `apps/web/lib/agent-lab/event-copy.ts`: copy for the new events, so the page stays exhaustive.
- Added `tests/agent-lab-metrics.test.ts`, the English and Chinese API docs and an Agent Note.

## Why

The metrics must be checkable from the artifact with no model judge. Usage is recorded as
`{ status: "unavailable" }` so missing token or cost data cannot read as zero.

## Validation

- Failure inventory and failing tests were written before `metrics.ts`; both existing strategies'
  stored metrics equal their recomputation. Checks are listed in the PR.

## Notes for the next person

No strategy emits the revision events yet; that and the new scenario land in the next change. The Agent
Note covers the whole #102 decision. Repeated and generic stops mostly describe the specialists'
fallback itinerary.
