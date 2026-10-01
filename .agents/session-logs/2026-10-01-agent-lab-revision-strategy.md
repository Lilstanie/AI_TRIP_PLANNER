---
date: 2026-10-01
author: Claude
branch: feature/agent-lab-revision-strategy-backend
pr: none
area: packages/shared, packages/orchestrator, apps/web, docs
contract-impact: packages/shared
---

# Add the targeted-revision strategy and the tight-budget scenario to Agent Lab

## What changed

- `multi-agent-targeted-revision`: the real workflow with its bounded loop on (three rounds), turning
  the loop's `onDecision` facts into the revision trace events. Strategy and scenario ids are added to
  `packages/shared/src/agent-lab.ts` and the strategy registry.
- `tokyo-couple-tight-budget`: the same trip and evidence at A$2,300, so the first round overruns and
  only transport is revised; the scripted baseline replays the same recording on either scenario.
- Added `tests/agent-lab-revision.test.ts`, route tests for the new ids, the metrics test's new
  combinations, and the API, architecture and orchestrator README text.

## Why

The default Tokyo trip has no conflict, so the repair loop had nothing to repair. A second scenario
keeps the earlier figures intact and shows the strategy changing nothing when there is nothing to fix.

## Validation

- Failure inventory and failing tests written before the strategy: shared first round, targeted
  specialist, previous outcome, score, stop reasons, bounded loop, no rerun of other specialists.
- The page does not show the third strategy until the next change; its E2E evidence lands there.

## Notes for the next person

Run with no model or provider keys: the multi-agent fixture runs do not guard against them. Only the
converged stop is reachable from the public scenarios; the other stops are covered by focused tests.
