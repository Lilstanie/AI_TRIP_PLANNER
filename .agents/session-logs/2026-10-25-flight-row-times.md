---
date: 2026-10-25
author: Claude Opus 5.5 (project thread)
branch: fix/TP-85-flight-row-times
pr: none
area: apps/web, packages/agents
contract-impact: none
---

# Flight row times

## What changed

- `apps/web/components/trip/timeline/BookingRow.tsx`: a flight row's time column shows the first
  segment's departure and the last segment's arrival for its leg (outbound for the flight in, inbound for
  the return). Without a leg it adds "time not set" to the row's meta line.
- `packages/agents/src/transport/index.ts`: flight candidates keep the provider's `outbound` and
  `inbound` legs, which `FlightCandidate` already allowed.
- `apps/web/lib/i18n/workspace-messages.ts`: zh "时间未定".
- `apps/web/tests/e2e/flight-row-times.e2e.mjs`: Melbourne → Sydney · 5 days, Day 1 and Day 5 flight
  rows in English and Chinese at 375 px.
- `docs/workspace-ui.md` and `docs/workspace-ui.zh.md`: one sentence.

## Why

Issue #660 (Jira TP-85): the Day 5 return flight row gave no time. The Day 1 "14:00–16:00" that the
reporter saw belonged to the stop next to it; no flight row ever showed a time. `FlightCandidate`
already had optional `outbound`/`inbound` legs, so no shared-contract change was needed.

## Validation

- `node scripts/redgreen.mjs flight-row-times -- apps/web/components/trip/timeline/BookingRow.tsx apps/web/lib/i18n/workspace-messages.ts packages/agents/src/transport/index.ts`:
  before exit 1, 2/6 ok; after exit 0, 6/6 ok.
- `pnpm turbo run typecheck lint test --filter=@trip/web --filter=@trip/agents`: 10/10 tasks.

## Limits

Mock fares have no legs, so the demo shows "time not set". With SerpApi the outbound leg has times;
the return row shows times only when an inbound leg is present, which the transport specialist does not
fetch today.

## Docs and Agent Notes

`docs/workspace-ui.md` and its zh pair. No Agent Note.
