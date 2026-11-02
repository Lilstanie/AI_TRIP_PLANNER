---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-265-follow-up-edits
pr: pending
area: packages/shared, packages/orchestrator, packages/agents, apps/web, docs
contract-impact: packages/shared
---

# Itinerary edits stay on their days; nights per city (TP-265)

## What changed

- `packages/shared/src/contracts.ts`, `chat.ts`: `CityNights`, `TripBrief.cityNights`,
  `RevisionRequest.places`, `PartialTripBrief.cityNights` (Joey approved the shared change in the
  thread, 2026-11-02).
- `packages/orchestrator/src/planning/edit-scope.ts` + `workflow.ts`: scoped edits and the
  fallback guard; `chat/chat.ts`: `change_itinerary` `days`/`places`, `nightsPerCity`;
  `chat-grounding.ts`: fallback sentence in the message's language.
- `packages/agents`: `cityStartDays` in `transport/legs.ts`; itinerary searches `revision.places`.
- `apps/web/lib/workspace/workspace.ts`: carries `cityNights` like `legModes`.
- Agent Note `architecture/2026-11-02-scoped-itinerary-edits-and-city-nights.md`; architecture
  diagrams doc en + zh.

## Why

See the Agent Note: three production follow-ups (Bali, Seoul, Bangkok) broke or faked the edit.

## Validation

- Tests: shared 58, agents 207, orchestrator 430, web vitest 663 passed. Typecheck all packages and
  web pass.
- Scratch tsx check: `cityStartDays(["Bangkok","Chiang Mai"],10,[Chiang Mai 3])` = `[1,7]`;
  without nights `[1,6]`; impossible request keeps the even split.

## Notes for the next person

Live behaviour needs the deployed site; re-run the Bali, Seoul and Bangkok follow-ups after merge.
