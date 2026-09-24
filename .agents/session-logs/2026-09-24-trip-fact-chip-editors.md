---
date: 2026-09-24
author: Claude Sonnet 5
branch: feature/trips-page-chat-flyout
pr: none
area: apps/web
contract-impact: none
---

# Redesign the When, Who and Budget chip editors as modal dialogs

## What changed

- `apps/web/components/preferences/TripFactChips.tsx`: chips read "Where"/"When"/"Who"/"Budget"
  while empty (was "Add destination" etc); every editor now opens `FactPopover` in `modal` mode.
- `apps/web/components/preferences/TripCalendar.tsx` (new): the styled `react-day-picker` range
  calendar, retokened onto `tokens.css`. Shared by `FactFields`' inline When editor and
  `DateRangePicker.tsx` (still a standalone dialog; only remaining caller is its own test).
- `apps/web/components/preferences/FactFields.tsx`: When is a full inline calendar (two months
  desktop, one on phone via CSS) with a summary line and Clear, replacing the two date inputs and
  calendar-dialog button. Who is a stepper row per traveller kind (Adults/Children/Infants/
  Seniors/Pets). Budget is four preset range cards (`role="radiogroup"`) plus a custom-amount field.
- `apps/web/lib/workspace/workspace.ts`: adds `Draft.party` (`{adults,children,infants,seniors,
  pets}`, optional), `partyFor`, `groupSizeFromParty`; `isDraft` accepts drafts with or without it.
- `apps/web/lib/workspace/trip-facts.ts`: `PARTY_ROWS` (labels/hints/aria wording), `factLabels`'s
  `who` now summarises the breakdown when present ("2 adults, 1 child"), falling back to "N
  travellers" when it is not.
- `apps/web/app/styles/trip-facts.css`: calendar, stepper and budget-card styles; per-fact modal
  widths (680px When, 420px Who/Budget, 512px default); removed the now-unused anchored-popover and
  `.filter-dates` rules.
- Updated `apps/web/tests/components/preferences/TripFactChips.test.tsx` and
  `.../workspace/Workspace.test.tsx` for the new chip text and editor structure.
- `docs/workspace-ui.md`: rewrote the Trip facts section for the above.

## Why

`groupSize` stays the only field the planner reads; children/infants/pets have no `TripBrief` field
of their own, so a plan currently counts them only as bodies in `groupSize` (noted as a limitation
in the doc, not a `packages/shared` change).

## Validation

- `pnpm --filter @trip/web typecheck` — passes.
- `pnpm --filter @trip/web lint` — no warnings or errors.
- `NODE_OPTIONS=--no-experimental-webstorage npx vitest run tests/components/preferences
  tests/lib/workspace` (from `apps/web`) — 74/74 passed.
- Full `apps/web` suite: `Workspace.test.tsx` has 8 unrelated failures from another agent's
  in-progress `apps/web/components/workspace/*` changes (out of this session's scope, confirmed by
  stashing just those files and rerunning — 37/37 pass without them).
- Did not run the app in a browser: not allowed to start a dev server on port 3000 this session.

## Notes for the next person

`pnpm verify:docs` reports a broken link in `docs/workspace-ui.md` to
`../.agents/notes/implemented/feature/2026-09-24-new-trip.md` — pre-existing, from another agent's
concurrent note archival, not touched by this diff. Not verified in an actual browser; a follow-up
UI pass with `ui-verification` would be worthwhile once the parallel `workspace/*` work lands.
