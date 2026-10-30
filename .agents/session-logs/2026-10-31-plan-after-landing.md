---
date: 2026-10-31
author: Claude Code
branch: fix/TP-194-plan-after-landing
pr: none
area: packages/agents, packages/orchestrator, docs
contract-impact: none
---

# The day plan starts after the outbound flight lands

## What changed

- `packages/agents/src/transport/arrival.ts`: `outboundArrival` reads the selected outbound flight's
  last segment; `detect_conflicts` in `packages/orchestrator/src/conflicts.ts` now uses it too.
- `packages/agents/src/itinerary/landing.ts` (new) and `index.ts`: no stop before landing day; on landing day, stops start
  90 minutes after landing (none after a 16:00 landing). The model gets `arrival` and a draft that
  stops before landing is rejected with feedback. Days before landing no longer count as missing or
  incomplete.
- Transfer-window helpers moved to `itinerary/transfer-windows.ts` to keep `index.ts` under 1,000
  lines; no behaviour change.
- Docs: `docs/architecture.md` (+ `.zh.md`).

## Why

A live Sydney to Tokyo trip on 2026-10-30 put 浅草寺 on day 1 at 15:00, while the overnight flight
landed on day 2 at 08:50. The itinerary never read the flight; only the conflict check did, so the
plan came back as needing the traveller.

## Validation

- `packages/agents/tests/itinerary/plan-after-landing.failures.md` written first; 4 of 5 new tests
  failed before the change, 5/5 after.
- `@trip/agents` 197/197, `@trip/orchestrator` 417/417, `pnpm typecheck` and `pnpm lint` pass.

## Notes for the next person

The 90-minute airport exit is a fixed estimate; it does not know the airport or immigration queues.
