---
date: 2026-10-29
author: Codex
branch: docs/tp-45-current-models
pr: none
area: docs/design/stage1
contract-impact: none
---

# Align member E's edit models after the itinerary redesign

## What changed

- Updated only UC-E1 and member E's activity, sequence and state models, in their English and Chinese files.
- Replaced the obsolete Apply/Cancel review checkpoint with deterministic checking, current-plan/tab validation, immediate apply and Undo.
- Distinguished snapshot item Undo from revalidated timeline Undo; documented per-Trip retention, background enrichment and replacement/reload invalidation, with the shipped itinerary decision linked.
- Left production code, E2E scripts, workspace UI docs and historical report/PDF/slides unchanged. Earlier local commit `0e1ec4b2` remains preserved on its own branch.

## Why

PR #752 merged as `be41c306`; its new interaction and E2Es supersede the old local regression proposal. Main `464a6a63e2095a155100fe8529592113d47306a6` includes #771 and #772, but its current UC-E1 and diagrams still show the removed review checkpoint.

## Validation

- Inspected current `TripEditor`, `plan-revision`, `useTimelineEdits`, `useTripUndo`, the shipped itinerary decision and upstream Undo/walkthrough scripts. The three revision/Undo modules are unchanged since the #752 merge.
- `pnpm verify:docs`: passed; paired-doc check against upstream/main: 29 pairs passed.
- Explicit changed-file Prettier and `git diff --check`: passed. All three Mermaid fences are byte-identical across languages and describe immediate apply/Undo; no rendered-diagram check claimed.
- GitHub checks on #752 final head `1f9be0aaa24ed3f5cfbaee213dddd02b806b703b`: 10 success, including CLI plan/workers/aggregate. This is upstream evidence, not a local browser rerun; the PR reports a 360-check walkthrough and known failures.
- No new browser, runtime or database validation was run for this documentation-only change.

## Notes for the next person

- TP-46's implementation is already delivered upstream; reconcile Jira with #752 instead of publishing duplicate runtime/tests.
- Jira currently shows no permission to view the TP space, so progress/status updates could not be saved. Retain a local update draft until access is restored.
- Local preparation only; no push, new PR, merge or external migration in this session.
