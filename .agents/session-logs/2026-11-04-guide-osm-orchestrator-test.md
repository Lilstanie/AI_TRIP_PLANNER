---
date: 2026-11-04
author: Claude Code
branch: test/TP-372-guide-osm-orchestrator
pr: 970
area: packages/orchestrator, docs
contract-impact: none
---

# Orchestrator-level test for the guide when OpenStreetMap is unreachable (TP-372)

## What changed

- `packages/orchestrator/tests/guide-osm-unreachable.e2e.test.ts` and its `.failures.md`, following
  #965: `runOrchestrator` with the itinerary and guide specialists and the real tool gateway in live
  OSM mode, every OSM URL at a closed local port, plus an abort case. Writes
  `output/e2e/guide-osm-unreachable/plan.json`.
- `docs/architecture.md` and `.zh.md` name the test next to `guide-places-unavailable`.

## Why

The `guide-places-unavailable` E2E needs a running server, so CI does not run it. This test runs in
`pnpm test`, drives the real Overpass and Nominatim adapters (not a mocked `maps.places`), and fails if
any request leaves the machine. It came from the closed duplicate #968. It uses a free ephemeral port,
because undici rejects port 9 as a "bad port" before connecting.

## Validation

- `REDGREEN_RUN="pnpm --filter @trip/orchestrator exec vitest run" node scripts/redgreen.mjs --base 12fe56b guide-osm-unreachable -- packages/agents/src/destination-guide/index.ts`:
  before exit 1 (`agent_failed` for destination-guide; `TypeError: fetch failed` instead of
  `AbortError`), after exit 0 (2 passed).

## Notes for the next person

#965 merged first; this PR was retargeted to `main`.
