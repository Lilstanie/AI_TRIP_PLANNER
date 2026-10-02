---
date: 2026-10-03
author: Codex
branch: feature/tool-gateway-provider-matrix
pr: none
area: packages/tools, docs
contract-impact: none
---

# Snapshot provider policy once per ToolGateway and record its behavior matrix

## What changed

- Added an internal gateway constructor with immutable runtime configuration plus injected network
  and clock dependencies; the public zero-argument factory remains unchanged.
- Routed Maps, Booking, SerpApi, Google Places and Weather configuration, network and time reads
  through the gateway's request-scoped runtime.
- Added the provider matrix for fixture isolation, Google/OSM selection, booking fallback, flight
  failure, weather horizons, lazy unavailable capabilities and concurrent gateway isolation.
- Documented the construction seam and repeatable matrix artifact in the tools package README.
- Added the proposed deep-provider-selection Agent Note and its specification links.

## Why

The old gateway grouped module namespaces, but each adapter could re-read mutable process state during
one Planning Run. This prefactor locks down current behavior before Maps, Booking and Weather move
behind deeper ports in issues #129, #130 and #128.

## Validation

- `pnpm --filter @trip/tools exec vitest run tests/provider-matrix.e2e.test.ts` — 7 passed; wrote
  `output/e2e/tool-gateway-provider-matrix/summary.json`.
- `pnpm typecheck` — 6 packages passed.
- `pnpm test` — 6 packages passed; tools 120 tests and web 450 tests passed.
- Agent Lab targeted-revision browser E2E — passed on desktop and phone; artifacts written under
  `output/playwright/agent-lab-revision/`.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, and `git diff --check` — passed.

## Notes for the next person

The first browser-E2E attempt stopped before launch because the repo has no Playwright package. The
successful rerun used the Codex workspace runtime through the script's supported `PLAYWRIGHT` option;
no dependency or lockfile changed. The architecture note remains proposed until the full migration.
