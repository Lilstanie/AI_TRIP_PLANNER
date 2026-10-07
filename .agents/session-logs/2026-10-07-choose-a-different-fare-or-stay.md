---
date: 2026-10-07
author: Claude Opus 5 (with A / @Lilstanie)
branch: feature/choose-fare-and-stay
pr: none
area: packages/shared, packages/agents, apps/web
contract-impact: packages/shared
---

# The traveller can take a different fare or stay

## What changed

- `packages/shared/src/contracts.ts`: `ProposalItem.selectionId`, naming the `StaySelection` or
  `FlightSelection` an item was priced from.
- `packages/shared/src/describe.ts` (new): `describeStayChoice`, `describeFlightChoice`,
  `stayChoiceCost`. Both specialists and the plan editor write the same sentence.
- `packages/agents`: accommodation and transport set `selectionId` and call the shared sentences.
  Their output is byte-identical, so no agent test changed.
- `apps/web/lib/trip/trip-edit.ts`: a `choose` operation; `settle()` extracted so every operation
  recomputes conflicts, status, section cost, the roll-up and the version the same way.
- `apps/web`: the alternatives rows became buttons; `onChoose` threads
  WorkspaceView → TripPanel → TripSection → ProposalDetails; the swap goes through
  `/api/trip/preview-edit`, so the server still owns the totals.
- `apps/web/app/styles/trip.css`: 44px minimum row height where the pointer is coarse.
- Agent Note `2026-10-07-selection-id-on-proposal-items`.

## Why

The cards added in the previous change could show what a choice beat but not take it; swapping a
fare still meant asking in chat and replanning. The editor had no safe way to find the item carrying
a selection's cost: matching by day picks the wrong one on a day with both a flight and a ground
hop, and matching by `location` makes traveller-facing prose load-bearing.

## Validation

`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm verify:docs`, `pnpm verify:protected` clean.
`pnpm test` 989/989 when `@trip/web` runs on its own (454/454). Running all six packages through
turbo at once, two unrelated tests time out at ~112s — `Workspace.test.tsx` recent-chat list and the
Agent Lab runs route — and both pass in 20s in isolation. Pre-existing contention, not this change.

Browser, mock mode, dev server on 3100 with `NEXT_DIST_DIR=.next-dev`:

- Desktop 1440x1000: took the cheaper fare. Card went MockAir Flexible AUD 1,680 → MockAir Economy
  AUD 1,240, the transport item's own sentence was rewritten to match, and the plan total went
  AUD 3,330 → AUD 2,890, exactly the AUD 440 difference.
- Phone 390x844: `scrollWidth` equals `innerWidth`.

## Notes for the next person

- Running `pnpm build` while the dev server is up overwrites `.next` and leaves the dev server
  serving 404s for its framework chunks. Start dev with `NEXT_DIST_DIR=.next-dev`, as
  [ui-verification](../skills/ui-verification/SKILL.md) says.
- Plans made before `selectionId` existed cannot be re-priced; the edit is rejected rather than
  guessing the item. They have to be replanned.
- Choosing is one click with no confirmation step. The timeline previews an edit before applying it;
  this applies straight away because the only thing that moves is a price the traveller just read.
