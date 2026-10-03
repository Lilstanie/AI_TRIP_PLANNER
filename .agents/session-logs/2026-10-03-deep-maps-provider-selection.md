---
date: 2026-10-03
author: Codex
branch: feature/deep-maps-provider-selection
pr: none
area: packages/tools, docs
contract-impact: none
---

# Deepen Maps provider selection behind ToolGateway

## What changed

- Added `createMapsPort()` in `packages/tools/src/maps-port.ts` to select fixture, Google or OSM
  once without expanding the public Maps namespace.
- Kept Google transit, SerpApi rail and driving fallback plus route-option partial success private to
  the Maps port while preserving direct adapter compatibility exports.
- Made `gateway-internal.ts` retain the selected Maps port and moved the OSM configuration warning
  out of the top-level gateway.
- Expanded the provider matrix with Maps capability, fallback and concurrency evidence.
- Updated the tools README, both architecture guide languages and proposed provider-selection Agent
  Note.

## Why

The gateway previously retained configuration but still reselected a Maps provider for every call.
One selected port now owns provider policy without changing the shared `MapsPort` contract or
Planning behavior.

## Validation

- `pnpm --filter @trip/tools typecheck` — passed.
- `pnpm --filter @trip/tools exec vitest run tests/provider-matrix.e2e.test.ts` — 10 passed; wrote
  `output/e2e/tool-gateway-provider-matrix/summary.json`.
- `pnpm --filter @trip/tools test` — 123 passed.
- `pnpm typecheck`, `pnpm test`, and `pnpm lint` — all six packages passed; web 450 tests passed.
- Agent Lab targeted-revision E2E — desktop and phone passed; artifact under
  `output/playwright/agent-lab-revision/`.
- Maps Planning-loop E2E — Tokyo-to-Kyoto route facts, Plan, Conflict, exact provenance and Artifact
  passed; artifact under `output/e2e/maps-provider-planning/`.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, and `git diff --check` — passed.

## Notes for the next person

Booking and Weather remain the next deep-port slices. Raw adapter export cleanup remains issue #131.
The broader Agent Lab benchmark's pre-existing all-`localStorage` assertion fails after its own UI
state changes; the scoped Maps Planning-loop E2E avoids treating Agent Lab UI state as workspace data.
