---
date: 2026-10-31
author: Claude Code
branch: fix/TP-205-itinerary-draft-feedback
pr: none
area: packages/agents, packages/orchestrator, apps/web
contract-impact: none
---

# The itinerary retry fixes only what was rejected, and memory claims match the account

## What changed

- `packages/agents/src/itinerary/index.ts`: the missing-day error names the days and the landing
  limit; the retry receives the rejected draft and is told to keep everything the error does not name.
- `packages/orchestrator/src/chat.ts`: `TripChatOptions.accountMemory`; when false the coordinator
  is told not to record lasting preferences or say one was saved, and none are returned.
- `apps/web/app/api/chat/route.ts` passes `accountMemory` (signed-in account with memory on).
- `docs/architecture(.zh).md`.

## Why

The live packed Tokyo check of TP-202 fell back to the local plan: the first error did not say
which day was missing, and the retry redrew the whole trip and put a stop before landing. With no
database the reply still said the pace was saved for future trips.

## Validation

- `packages/agents` and `packages/orchestrator` vitest pass; no new tests (Joey asked for as few as
  possible). A live rerun on the Mac follows the merge.

## Limitations

- The fallback still favours shrines and temples; stay nights do not follow an overnight flight.
