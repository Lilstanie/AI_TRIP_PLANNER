---
date: 2026-10-23
author: Claude Code
branch: feature/one-day-trips
pr: none
area: packages/shared, packages/orchestrator, packages/agents, apps/web, docs
contract-impact: packages/shared
---

# One-destination day trips plan without accommodation

## What changed

- `packages/shared/src/contracts.ts`: `TripBrief` accepts same-day dates for one destination with
  `noAccommodation: true`. The dates error names that exception (#539).
- `packages/orchestrator/src/brief.ts`: `mergeBriefPatch` sets `noAccommodation: true` for
  same-day dates when the flag is unset. `applyBriefPatch` rejects only reversed dates.
- `packages/orchestrator/src/chat-offline.ts`: `statedTripDays` reads "1 day".
- `packages/orchestrator/src/chat.ts`: the prompt says a one-day trip is valid.
- `packages/agents/src/transport/validation.ts` and `dining/index.ts`: the day counters accept zero
  nights.
- `apps/web/lib/workspace/trip-facts.ts` and `lib/i18n/workspace-messages.ts`: the new dates message
  in English and Chinese.
- Tests: the orchestrator's "one-day count is not a length" case now expects a same-day trip. The web
  trip-facts message test was updated.
- Agent Note `implemented/architecture/2026-10-23-one-day-trips.md`, with a cross-link in the
  2026-10-15 day-count note.
- `docs/architecture.md`, `docs/api.md` and `docs/design/stage1/02-use-cases.md`, with their Chinese
  pairs.
- `apps/web/tests/e2e/one-day-trip.e2e.mjs` and its failure inventory (written first).

## Why

Joey chose on the #539 decision card to allow one-day trips by changing the shared contract.

## Validation

- `node scripts/redgreen.mjs one-day-trip -- <eight source files>`: before, exit 1 with 6/17 ok;
  after, exit 0 with 17/17 ok. The run covers the API (a day trip plans on day 1 with no
  accommodation section; keeping a stay, two cities, or reversed dates are refused; a 3-day control
  keeps 3 days and a stay) and the UI in English and Chinese ("1 day in Sydney from 14 Dec 2026"
  plans at once and the Dates chip reads "14 Dec · 1 day" / "12月14日 · 1 天").
- Unit tests: shared 58, agents 144, orchestrator 296 and web 642, all passing. Typecheck passes in
  all four packages.
