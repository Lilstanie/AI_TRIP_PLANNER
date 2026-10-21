---
date: 2026-10-21
author: Codex
branch: fix/agent-lab-multicity-merge-audit
pr: 449
area: packages/orchestrator, apps/web, docs
contract-impact: api
---

# Make Agent Lab strategy summaries match expected outcomes and must-pass checks

## What changed

- Tightened benchmark E2E summary pass/fail counts and partition assertions.
- Updated Tokyo–Kyoto fixture evidence to v2 and synchronized API docs.
- Integrated origin/main at 3d8a9e1 (PR #473) and reran affected UI checks.

## Why

- An unexpected or partial run must not count as passed; every scenario must remain in the denominator.
- The v2 fixture moves the arrival-day activity after the train arrival.

## Validation

- `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e agent-lab-benchmark`: passed, 132s; runner `output/e2e/runner/2026-10-21T01-17-57-568Z.json` (other checkout ran E2E/build concurrently).
- `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e agent-lab-benchmarks`: passed, runner `output/e2e/runner/2026-10-21T01-25-02-119Z.json`.
- `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e multicity-triage`: passed, runner `output/e2e/runner/2026-10-21T01-26-41-179Z.json`.
- Booking and weather provider planning E2Es passed; runner reports `2026-10-21T01-28-51-879Z.json` and `2026-10-21T01-29-28-186Z.json`.
- `pnpm --filter @trip/web test`: 57 files / 642 tests passed; jsdom canvas warnings only.
- `pnpm --filter @trip/orchestrator test`: 23 files / 280 tests passed; orchestrator typecheck passed.
- `pnpm --filter @trip/agents test`: 13 files / 138 tests passed.
- Web typecheck and lint passed. `trip-initial-scroll` passed in 23s across desktop and phone states; runner `output/e2e/runner/2026-10-21T01-37-06-509Z.json`.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs` (27 pairs), `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts` (87 scripts), `pnpm format:check-changed origin/main`, and scoped added-comment check passed.
- Earlier benchmark attempt `output/e2e/runner/2026-10-21T00-58-18-767Z.json` failed after 289s; retained as failure evidence.

## Notes for the next person

- E2Es use fixture/mock data and do not establish live provider or model quality.
- Await CI on the pushed PR head; do not merge without the parent maintainer's instruction.
