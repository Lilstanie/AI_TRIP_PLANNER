---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-274-transit-far-dates
pr: none
area: packages/tools, apps/web, docs
contract-impact: none
---

# Routes for trips more than 100 days out

## What changed

- `packages/tools/src/maps-port.ts`: `departureForGoogle` moves a departure outside Google's transit window to the same weekday and local time inside it instead of throwing.
- `apps/web/lib/integrations/google.ts`: `requestGoogleRoute` does the same for route lines; it throws only when the departure is not a date.
- `apps/web/tests/lib/integrations/google.test.ts` and `apps/web/tests/lib/trip/trip-edit.test.ts`: the two tests that asserted the old rejection.
- `docs/architecture.md` + `.zh.md`: one paragraph.

## Why

Live test 2026-11-02: London/Paris (April 2027), Queenstown (March), Vietnam (May) and New York (February) had 89 failed `maps.route` calls, every day showed an unverified route and London→Paris and Hanoi→Ho Chi Minh City legs were missing. Google only accepts transit departures up to 100 days ahead, and the throw also skipped the driving query.

## Validation

- `pnpm --filter @trip/tools test` 173 passed, `pnpm --filter @trip/web test` 663 passed, typecheck and lint passed.

## Notes for the next person

Timetables are a weekday proxy; holiday timetables on the real date are not checked.
