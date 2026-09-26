---
date: 2026-09-27
author: Claude Code
branch: feature/conversation-preferences-and-scope
pr: none
area: packages/shared, packages/orchestrator, packages/agents, apps/web, docs
contract-impact: packages/shared
---

# Chat updates trip preferences, and "flights arranged / hotel booked" sticks

## What changed

- `packages/shared`: `TripBrief`/`PartialTripBrief` gain `learnedPreferences`, `excludeFlights`,
  `bookedStay` (`BookedStay`).
- `packages/orchestrator`: `update_trip_brief` records them and the coordinator prompt stops asking
  about flights or other stays. `specialistBrief` merges the learned list for the specialists, and the
  supervisor always yields a Stay section for a booked stay.
- `packages/agents`: transport leaves flights unpriced ("arranged by you") and accommodation returns
  the booked stay without a search.
- `apps/web`: the draft carries the fields, and Trip preferences lists them under "Learned from your
  chats" with remove buttons.
- Docs: architecture, api and workspace-ui (EN and ZH); the
  [conversation scope note](../notes/implemented/feature/2026-09-27-conversation-scope.md).

## Why

Owner feedback (local `docs/problem.md`): chat-stated preferences were lost, and the assistant kept
asking about flights after being told not to.

## Validation

- `pnpm typecheck`: passed. `pnpm test`: passed in every package (web 371, orchestrator 116,
  agents 117).
- `node apps/web/tests/e2e/conversation-scope.e2e.mjs` (live): 15/15 on the second run. The first
  run failed 1 check (the supervisor skipped accommodation) and led to the Stay-section fix; the
  learned-preference language instruction was tightened in the same round.
- Browser: Trip preferences shows the three learned rows, and removing one updates the list and
  status.

## Notes for the next person

- The booked stay is a single item on day 1, even for a trip across several cities.
- Turn 1 of the E2E (Shanghai, AUD 3000, from Sydney) reported an infeasible budget in live mode.
  That comes from live fares, not from this change.
