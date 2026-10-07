---
date: 2026-10-07
author: Claude Opus 5 (with A / @Lilstanie)
branch: feature/choose-flight-and-stay
pr: none
area: apps/web
contract-impact: none
---

# Getting around shows the flight, and both cards show what they beat

## What changed

- `apps/web/components/trip/ProposalDetails.tsx`: new `FlightCard` renders each `FlightSelection`
  in the transport section; new `Alternatives` lists the candidates the chosen option beat, with the
  price difference, on both the stay and the flight card.
- Same file: the stay card's "Review hotel choices" button is gone. It opened the plan summary, not
  a chooser, and `TripPanel` already has a "Review plan" button for that. `onReview` therefore left
  `ProposalDetails` and `TripSection`.
- `apps/web/app/styles/trip.css`: `.alternatives` block; cheaper differences use `--ok`.
- `apps/web/lib/i18n/workspace-messages.ts`: five new keys with Chinese; the stale
  "Review hotel choices" key removed.
- Tests: the superseded assertion in `ProposalDetails.test.tsx` now checks the button is gone.

## Why

`AgentProposal.flights` has shipped on every plan since the flight-selection contract landed, and
nothing in the trip panel read it, so Getting around described flights only in a sentence. Stays had
a card but their candidates were equally unread. The traveller saw one price with no way to tell
whether it was the cheap option or the expensive one. In mock data the planner takes the AUD 1,680
flexible fare over a AUD 1,240 economy one, and a AUD 1,150 stay over a AUD 650 one; both are now
visible.

## Validation

`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm verify:docs`, `pnpm verify:protected` clean.
`pnpm test` 989/989.

Browser check in mock mode on the in-app browser, dev server on port 3100:

- Desktop 1440x1000: both cards asserted through the DOM — flight card shows carrier, depart,
  travellers and the alternative with its difference; stay card shows three alternatives.
- Phone 390x844: screenshot taken, layout holds, `scrollWidth` equals `innerWidth` (390), cheaper
  differences render green.
- One console error, `InvalidStateError: Transition was aborted`, comes from the phone shell's view
  transitions when tabs are switched quickly; it predates this change.

**Not** run: `output/playwright/` screenshots through an E2E script. Playwright is not installed on
this machine and the browser scripts require it through `PLAYWRIGHT=`.

## Notes for the next person

- The cards show the alternatives but cannot select one. `/api/trip/preview-edit` has only
  activity-scoped operations (`verify`, `move`, `time`, `place`, `undo`), so choosing a different
  fare or stay still means asking in chat. A `choose` operation there is the next step.
- `FlightCandidate` carries `outbound` and `inbound` legs, but the transport agent does not copy
  them into the plan's candidates, so the card cannot show segment times yet.
