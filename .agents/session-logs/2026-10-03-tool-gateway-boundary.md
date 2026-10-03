---
date: 2026-10-03
author: Codex
branch: feature/enforce-tool-gateway-boundary
pr: 143
area: packages/tools, packages/agents, packages/orchestrator, apps/web, docs
contract-impact: none
---

# Close the public provider bypass after the deep-port migration

## What changed

- `packages/tools/src/index.ts` now exports the gateway and request-mode helpers, not raw provider namespaces; `tests/public-boundary.test.ts` pins that surface.
- `packages/tools/src/maps-port.ts` reports a selected but unusable Google Maps policy accurately; the provider matrix records the call-time failure.
- `packages/agents/src/accommodation/index.ts` and `destination-guide/index.ts` no longer describe live evidence as mock data in Plan assumptions.
- The proposed provider-selection note moved to `implemented/`; paired architecture docs, package README and the weather note now describe the shipped boundary.
- Public HTTP fixture Planning-loop and stubbed live Agent Lab E2Es save reviewable Plan/Artifact evidence.

## Why

The last migration slice must make bypasses impossible through the production package entry point without changing the shared ports or the public zero-argument gateway factory. A live E2E exposed stale mock-only assumption text even though live adapters ran; the correction follows the selected evidence rather than changing provider policy.

## Validation

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:scripts`, `pnpm build` — passed before the final assumption-text and Maps diagnostic edits; direct scoped checks followed those edits.
- Direct full package Vitest runs — shared 49, services 4, tools 128, agents 124, orchestrator 225, web 450 passed. The first direct web run lacked the package script's `NODE_OPTIONS` and failed in JSDOM; rerunning with `NODE_OPTIONS=--no-experimental-webstorage` passed 450/450.
- Direct TypeScript checks for tools, agents and orchestrator — passed after their source edits.
- `node apps/web/tests/e2e/maps-provider-planning.e2e.mjs`, `booking-provider-planning.e2e.mjs`, `weather-provider-planning.e2e.mjs`, `provider-boundary-planning.e2e.mjs` — passed against a local dev server; outputs under `output/e2e/`.
- `packages/orchestrator/tests/provider-boundary-live.e2e.test.ts` — 1/1 passed using stubbed provider responses; saved Artifact and summary under `output/e2e/provider-boundary-live/`.
- Provider matrix and public boundary — 15/15 focused checks passed; matrix summary at `output/e2e/tool-gateway-provider-matrix/summary.json`.
- `node scripts/verify-docs.mjs`, `node scripts/verify-protected-files.mjs`, translation-pair checker, scoped Prettier, `git diff --check` — passed.

## Notes for the next person

- PR #143 is stacked on Weather PR #141; merge the provider slices in order. No shared contract changed.
- Browser-only `agent-lab-revision.e2e.mjs` did not start in the isolated worktree because Playwright is absent. Its public HTTP Planning-loop replacement passed, but this slice has no new browser screenshots.
- Live E2E deliberately leaves SerpApi unconfigured; flights remain unavailable rather than receiving fixture fares. Real-key deployment verification remains separate work.
