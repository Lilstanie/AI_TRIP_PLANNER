# Agent Note: Ideas as an "N ideas" chip, legs without Show distances

Status: implemented
Owner: spec #755, ticket #761

## Problem

The 2026-10-27 [one itinerary column](2026-10-27-itinerary-interaction.md) kept Ideas as a full section
above Day 1 ([across days](2026-10-27-cross-day-drag.md)) and gave the itinerary a Show distances switch.
Every parked place took a full row above the plan, so a trip with several ideas pushed the days off the
first screen, and the switch hid something the traveller never asked to hide.

## Decision

- No Ideas section renders. When at least one place is parked, an "N ideas" chip (`1 idea` for one,
  `N 个备选地点` in Chinese) sits in the toolbar above the day strip; with none it is absent. The count is
  the parked places plus the dining specialist's restaurant suggestions, the same list the Ideas tab shows.
- Pressing the chip opens the [Add to trip panel](2026-10-27-add-to-trip-panel.md) for the open day on its
  Ideas tab; the panel closes when the day changes. The Ideas tab is the one place to schedule an idea.
- While a Stop is dragged the chip is a drop target (`data-drop-zone="ideas"`, outlined). A drop is one
  `idea` edit with an Undo, as before; Move to ideas in the stop menu is unchanged. The chip is disabled
  while a revision runs or the trip is locked, so nothing is dropped then.
- The Show distances switch, `useShowDistances`, the `trip.show-distances.v1` key and the `showDistance`
  prop are deleted. Every leg shows its mode, minutes, distance when known and Directions link, and the
  stored preference is neither read nor written.
- The panel has one target kind, a day. Adding a place straight to Ideas, editing, commenting on or
  removing a parked place in place, and dragging an idea out are gone; ideas are scheduled from the panel.
- Supersedes only the Ideas-at-the-top section and the Show distances switch of the 2026-10-27 decision;
  instant edits, whole-row drag, the single stop menu, the Add to trip panel and the day and itinerary
  menus stand. No `packages/shared` change.
- `ideas-chip` is the E2E script (desktop, phone, Chinese); it writes `result.json` and screenshots under
  `output/playwright/ideas-chip/`.

## Alternatives considered

- Keep the section but collapse it by default: still a row above the plan and a second way to list the same places.
- Show the chip at zero ideas so the first stop can be dragged there: the chip appearing mid-drag shifts
  the day list under the pointer, and Move to ideas already parks the first stop.
- Keep the switch and hide it in a menu: the request was to delete it; legs are one short line.

## Consequences

- The plan is the first thing under the budget, and ideas cost one chip.
- A traveller can no longer add a place directly to Ideas, remove a parked place or edit its details from
  the list; they schedule it, then use the stop menu (Remove, Edit details) on the day.
- A restaurant suggestion can be scheduled but no longer dismissed.
- A browser that stored the Show distances preference as off now shows distances again.
- An idea count that changes after Undo is recomputed from the plan, so the chip never lags it.

## Sources

- Issue #761, spec #755.
