---
date: 2026-11-04
author: Claude Code
branch: fix/guide-places-unavailable
pr: 965
area: packages/agents, apps/web/tests/e2e, docs
contract-impact: none
---

# Destination guide and dining degrade when OpenStreetMap is unreachable

## What changed

- `packages/agents/src/place-lookup.ts`: `lookupPlaces` turns a failed MapsPort place search into no
  places plus an assumption line, and rethrows the abort inside the catch.
- Destination guide, dining and itinerary call it; guide and dining report source `unavailable`
  (`Maps provider`) when a lookup failed. No attraction or venue is invented.
- `eslint.config.mjs`: `no-restricted-syntax` rejects other `maps.places` calls in `packages/agents/src`.
- New E2E `guide-places-unavailable` with failure inventory; three focused tests in
  `packages/agents/tests/destination-guide/index.test.ts`, written before the fix.
- `docs/architecture.md` (+ zh) and an Agent Note
  ([place lookups degrade](../notes/implemented/bug-fix/2026-11-04-place-lookups-degrade.md)).

## Why

Dining had the same uncaught lookup, so fixing only the guide still failed the plan (the red run
ended on `agent_failed` for dining). The source puts the missing place evidence first, as the
itinerary already does.

## Validation

- Reproduced: stream ended `agent_failed` destination-guide, `Unable to update this trip`.
- `node scripts/redgreen.mjs guide-places-unavailable -- <guide> <dining>`: before 1/16, after 16/16.
- Lint on old code: 4 `no-restricted-syntax` errors; after: clean. `pnpm lint` passed.
- `pnpm turbo run typecheck --filter=...@trip/agents` passed; tests: agents 216, orchestrator 444,
  web 685 passed.
- `verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-artifacts`, `verify:e2e-selectors`,
  `check-file-length`, `check-ui-copy`, Prettier, `check:comments` (two exact entries added to
  `comment-exceptions.json`) and `test:scripts` (79 pass) passed.

## Notes for the next person

With `MAPS_PROVIDER=osm`, accommodation fails on `Unsupported booking provider: osm`
(`packages/tools/src/booking-port.ts`), so the E2E plans with `noAccommodation: true`. Jira: TP-372.
