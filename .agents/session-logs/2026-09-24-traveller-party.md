---
date: 2026-09-24
author: Claude Opus 5.5
branch: feature/trips-page-chat-flyout
pr: none
area: packages/shared, packages/agents, packages/orchestrator, apps/web
contract-impact: packages/shared
---

# Send the traveller breakdown to the planner

## What changed

- `packages/shared/src/contracts.ts`: optional `TravellerParty` (`adults`, `children`, `infants`,
  `seniors`, `pets`) as `TripBrief.party`, and `partyPeople`; `chat.ts` adds
  `PartialTripBrief.party`.
- `packages/agents/src/prompts/traveller-preferences.ts`: the shared specialist rule now covers the
  party (plan for it, say when unconfirmed, trust `groupSize` if they disagree); transport and
  accommodation add `party` to the brief they send.
- `packages/orchestrator/src/chat.ts`: the coordinator does not re-ask what `knownSoFar.party` says.
- `apps/web/lib/workspace/workspace.ts`: `Draft.party` is the shared type; `parseDraft`,
  `knownFromDraft` and `draftFor` carry it only while it adds up to `groupSize`, and
  `draftWithKnown` drops it when the chat learns another head count.
- Tests in `packages/shared/tests/contracts.test.ts`, `apps/web/tests/lib/workspace/workspace.test.ts`
  and `TripFactChips.test.tsx`; docs `docs/api.md`, `docs/workspace-ui.md`; Agent Note
  `implemented/architecture/2026-09-24-traveller-party.md`.

## Why

The owner asked to remove the limit that children, infants, seniors and pets reached the planner
only as a head count.

## Validation

- `pnpm -r typecheck`, `pnpm -r lint`: pass.
- `pnpm test`: shared 49, services 4, tools 113, agents 117, orchestrator 115, web 370, all passed.
- `pnpm verify:docs`, `pnpm verify:protected`: pass.

## Notes for the next person

No provider filters by pet policy or accessibility, so suitability is the models' judgement from
evidence, flagged when unconfirmed. Children and infants are still costed as full travellers.
