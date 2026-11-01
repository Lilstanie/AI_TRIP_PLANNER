---
date: 2026-11-01
author: Claude Code (for Joey)
branch: fix/TP-236-return-leg-note
pr: none
area: apps/web, docs
contract-impact: none
---

# Flight offer cards no longer promise a return leg on Choose (TP-236 follow-up)

## What changed

- `components/trip/timeline/FlightOffers.tsx`: a round-trip fare without its return leg shows the
  existing `returnFlightsNotLookedUp` line ("Return flights not looked up; the price covers the way
  home.") instead of `returnLegOnChoose`, which is removed from both message files.
- `docs/workspace-ui.md` (+ zh): the flight card section says the line stays after choosing.

## Why

Production check after PR #886 (admin passcode, live data, Melbourne → Sydney 11–14 Dec): choosing
QF 418 re-priced the trip, but the chosen card still had no return leg and kept saying "Return flight
details load when you choose this fare". Nothing in the app looks up a return leg on Choose; only
the fare the planner picked carries one, so the copy was wrong, not the data.

## Validation

- Production run of PR #886 before this fix: 6 flight and 6 stay cards, no duplicates, every flight
  card "Round trip · Economy" / "往返 · 经济舱", notes compare outbound legs, 0 page errors,
  no horizontal page scroll at 1440 px in en and zh.
- Checks listed in the PR.

## Notes for the next person

- Looking up the return leg when another fare is chosen would be a new feature in the transport agent.
