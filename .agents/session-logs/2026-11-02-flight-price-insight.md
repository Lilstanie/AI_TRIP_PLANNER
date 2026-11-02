---
date: 2026-11-02
author: Claude (for Joey)
branch: feature/TP-261-flight-price-insight
pr: pending
area: packages/shared, packages/tools, packages/orchestrator, apps/web
contract-impact: packages/shared
---

# Flight answers show Google's price level, typical range and trend, with a buy-or-wait line

## What changed

- `packages/shared/src/chat.ts`, `ports.ts`: optional `FlightPriceInsight` on `FlightOption` and `FlightAnswer`.
- `packages/tools/src/serpapi.ts`: parses `price_insights` from the Google Flights search.
- `packages/orchestrator/src/chat/flight-answer.ts`: copies the insight and adds one advice sentence.
- `apps/web/components/chat/FlightResults.tsx`, `chat.css`, `lib/i18n/messages/{en,zh}-fares.ts`: level badge, range, SVG trend line.
- Agent Note `implemented/feature/2026-11-02-flight-price-insight.md`; `docs/architecture(.zh).md`.

## Why

Joey picked this after reviewing the open-source ticket-monitoring project; Google already returns the
data in the call we make, so no scraping, cron or new table. Copy lives outside `MessageKey` (TS2590).

## Validation

- `pnpm typecheck`, tools/orchestrator/shared tests, web tests and lint: see PR Evidence.
- Scratch E2E (not committed): stubbed SerpApi response with low/typical/high/missing insight through
  `createBookingPort` → `answerFlightQuery`, then the frame replayed into the dev app via Playwright at
  1440×900 and 390×844, zh and en. Screenshots in the PR.

## Notes for the next person

Not checked against a real SerpApi response yet; verify on the deployed site after merge. Planner
flight legs ignore the insight. A price watch with alerts (idea B) is not built.
