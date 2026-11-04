---
date: 2026-11-04
author: Claude Code
branch: fix/flight-query-local-date
pr: none
area: packages/shared, packages/orchestrator, apps/web, docs
contract-impact: packages/shared
---

# Flight questions read yearless dates in the traveller's time zone

## What changed

- `packages/shared/src/chat.ts`: optional `ChatRequest.timeZone` (`TimeZone`, IANA names only).
- `packages/orchestrator/src/chat/flight-query.ts`: `parseFlightQuery(message, today, timeZone)`
  seeds the earliest date from the local calendar day; UTC without a zone.
- `apps/web/app/api/chat/route.ts` passes the zone; `useWorkspaceTransport` sends the browser's zone.
- Failure inventory and tests: `packages/orchestrator/tests/flight-query-local-date.*`,
  `apps/web/tests/app/api/chat/flight-time-zone.test.ts`.
- `docs/api.md`, `docs/api.zh.md`, and the
  [Agent Note](../notes/implemented/bug-fix/2026-11-04-flight-query-local-date.md).

## Why

The browser zone beats origin coordinates: the asker's day matters, and it needs no geocoding.

## Validation

- New orchestrator tests on the old code: 8 failed, 4 passed; after the fix all 12 pass.
- Route test with the zone dropped from the route: depart `2026-02-28` instead of `2027-02-28`.
- Checks from the pre-push-checks skill: see the pull request Evidence section.

## Notes for the next person

- The coordinator envelope's `today` still uses destination coordinates or UTC, not `timeZone`.
- `PAIR` caps the origin capture at 31 characters, so "cheapest flight from Los Angeles to Tokyo"
  is not parsed and goes to the coordinator.
