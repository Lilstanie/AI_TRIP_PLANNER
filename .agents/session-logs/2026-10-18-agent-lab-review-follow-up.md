---
date: 2026-10-18
author: Codex
branch: fix/agent-lab-review-findings
pr: none
area: apps/web, packages/orchestrator, docs
contract-impact: none
---

# Finish Agent Lab report and trip-card review fixes

## What changed

- Made Agent Lab benchmark fixture outcomes, medians, and serialized report projections deterministic.
- Aligned scripted scenario itinerary days with inclusive trip date ranges while retaining night-based stay and meal costs.
- Added distinct titles for identical saved trips and year display for same-year trips outside the current year.
- Updated the English and Chinese architecture summaries to describe all 12 scenarios and stable fixture reports.

## Why

The repeated trip-card browser fixture still does not restore two cards. Its catalog active IDs were found to reference nonexistent records and corrected, but the focused run was interrupted before it could provide a result. This remains unresolved and is not passing evidence.

## Validation

- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`: passed earlier in this worktree.
- `git diff --check`: passed after the final code edits.
- Agent Lab benchmark runner `2026-10-17T13-48-34-115Z.json`: passed, 41 artifacts; retained in `output/playwright/agent-lab-benchmark/`.
- `trip-ui-triage` runner `2026-10-17T13-59-57-215Z.json`: failed waiting for sidebar Trips count 2.
- A later focused rerun was stopped by the user; runner `2026-10-17T14-00-59-791Z.json` records the interrupted launch and is not a test result.

## Notes for the next person

The duplicate trip-card E2E changes remain uncommitted and need a root-caused restore fix plus a retained successful browser artifact. The #402 JSON/Markdown report projection assertion was added after the successful benchmark run and has not itself been executed.
