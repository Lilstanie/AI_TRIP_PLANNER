---
date: 2026-10-19
author: Codex
branch: fix/agent-lab-multicity-validation
pr: 449
area: apps/web, packages/agents, packages/orchestrator, docs
contract-impact: none
---

# Tighten benchmark and multi-city validation

## What changed

- Updated Agent Lab benchmark fixtures, evaluation, documentation, and E2E coverage.
- Added transfer-time windows for multi-city activities and an itinerary regression case.
- Aligned provider E2E evaluator versions and ignored missing favicon console noise in benchmark browser checks.

## Why

Issues #402 and #437 were closed by #438; this PR carries validated follow-up coverage without reopening them.

## Validation

- `pnpm --filter @trip/orchestrator test` — 279 passed; `pnpm --filter @trip/agents test` — 132 passed.
- `pnpm turbo run typecheck --filter=@trip/orchestrator --filter=@trip/agents --filter=@trip/web` — passed.
- `pnpm --filter @trip/orchestrator lint` and `pnpm --filter @trip/agents lint` — passed.
- `pnpm verify:docs`, `pnpm verify:pairs` (27 pairs), `pnpm verify:protected`, Prettier, and `git diff --check` — passed.
- Chrome E2E: `multicity-triage`, `trip-ui-triage`, `booking-provider-planning`, `provider-boundary-planning`, `agent-lab-benchmark`, and `agent-lab-benchmarks` — passed. Runner artifacts are listed in PR #449.

## Notes for the next person

CI for PR #449 is pending. The multi-city validator requires transfer-day activities to include times that establish their order relative to the transfer.
