---
date: 2026-10-29
author: Codex
branch: feature/TP-156-trip-calendar
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Add the Trip home week and month calendar

## What changed

- Replaced the Trip home read-only month grid with Week/Month views backed by the existing itinerary
  projection in `apps/web/lib/trip/calendar.ts`.
- Added Trip-bounded navigation, retained date selection, timed/all-day regions, overlap visibility,
  stable activity selection and the existing shared itinerary editor.
- Fixed edit validation and Undo so unrelated untimed activities do not block timed edits and are
  preserved when a timed edit is reversed.
- Added the Calendar decision note, updated paired product docs and expanded the failure inventory
  and fixture-backed browser journey.

## Why

The old Calendar invented off-Trip dates and could not expose the Trip's timed and all-day plan.
Undo also rebuilt activity state from timed entries, dropping valid untimed stops.

## Validation

- Red: `LABEL=tp156-red-undo-untimed CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true node apps/web/tests/e2e/trip-home-calendar.e2e.mjs` failed because the untimed `markets` activity disappeared after Undo.
- Green: `LABEL=tp156-green-undo-untimed CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true node apps/web/tests/e2e/trip-home-calendar.e2e.mjs` passed.
- Final reviewed tree: `LABEL=tp156-green-final CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true node apps/web/tests/e2e/trip-home-calendar.e2e.mjs` passed all 36 assertions.
- Final lint, scoped comment check and `pnpm verify:e2e-artifacts` passed; phone Chinese and western
  browser screenshots show Calendar content.
- Review-trip-planner and Ponytail full have no remaining blockers after removing redundant exports,
  keys and the date map. The shared edit/Undo path preserves untimed activities.
- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`, `pnpm verify:pairs`,
  `pnpm verify:protected` and `pnpm verify:e2e-selectors` passed.
- The added-comment gate passed over every changed JS/TS path; its 23-case CLI acceptance journey
  passed.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs` reported no added helper-copy classes.
- `pnpm --filter @trip/web test` reported the four inherited failures recorded for tip `95c80303`
  in `2026-10-29-tp153-final-verification.md`; 631 tests passed.

## Notes for the next person

Evidence uses local fixtures and mock services. It does not claim live-provider, physical-device or
remote CI coverage. No push or merge was performed.
