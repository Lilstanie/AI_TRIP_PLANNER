---
date: 2026-10-03
author: Codex
branch: feature/deep-weather-provider-selection
pr: none
area: packages/tools, packages/orchestrator, apps/web, docs
contract-impact: none
---

# Keep weather selection behind a request-scoped port

## What changed

- `packages/tools/src/weather-port.ts` owns fixture, Google Weather, Open-Meteo forecast and archive selection using the gateway's captured configuration and clock. `weather.ts` remains a temporary direct-call compatibility surface until #131.
- `packages/tools/tests/provider-matrix.e2e.test.ts` checks days 0, 10, 11, 14 and 15, captured credentials, and lazy missing-key failure; it writes a repeatable matrix artifact.
- `packages/orchestrator/tests/weather-provider-planning.e2e.test.ts` runs five specialists through the Planning loop with a coordinate-bearing Maps Port and actual Weather Port. `apps/web/tests/e2e/weather-provider-planning.e2e.mjs` checks the public Agent Lab stream and saved Artifact.
- `packages/tools/README.md`, `docs/architecture.md`, `docs/architecture.zh.md` and the implemented weather note describe the live historical archive after day 14.

## Why

The old weather note described a seasonal fixture after day 14, while runtime already used the Open-Meteo archive. The refactor preserves that runtime behavior and keeps provider choice in one port.

## Validation

- `pnpm --filter @trip/tools exec vitest run tests/provider-matrix.e2e.test.ts tests/weather.test.ts` — 18 passed.
- `pnpm --filter @trip/orchestrator exec vitest run tests/weather-provider-planning.e2e.test.ts` — 1 passed; `output/e2e/weather-provider-planning/with-coordinates/summary.json` passed all four checks.
- `node apps/web/tests/e2e/weather-provider-planning.e2e.mjs` — 5 checks passed; Artifact in `output/e2e/weather-provider-planning/2026-10-03-deep-weather-provider-selection/`.
- `pnpm test` — all six package tasks passed; `pnpm typecheck` — all six package tasks passed; `pnpm lint` and `pnpm build` passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs` and scoped Prettier checks passed; `git diff --check` passed.

## Notes for the next person

The public Agent Lab fixture has no Maps coordinates, so its E2E preserves monthly weather context. The five-specialist Planning-loop E2E supplies coordinates through the public Maps Port and confirms the actual Weather Port result. The deep-provider Agent Note stays proposed until #131 removes direct exports.
