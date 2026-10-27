# Agent Note: One stop menu and in-place popovers

Status: implemented
Owner: spec #743, ticket #746

## Problem

A Stop's menu mixed arrow moves, a day picker and note editing, and its editors opened inside the place
card or, on a phone, as a modal sheet. The traveller had to select a row before editing it and could not
shift a stop to the next day, or visit a place twice, without leaving the list.

## Decision

- A Stop has one menu: Adjust schedule, Edit details, Add a comment, Move to ideas, Move to previous
  day, Move to next day, Add again and Remove. Replace place, Open in Maps, the visit-progress items and
  Mark as booked stay as secondary items. An Idea offers Schedule on a day, Edit details, Add a comment
  and Remove.
- Move earlier, Move later and Move to another day are removed, with the day picker, the note title and
  their strings and translations. Move to previous day and Move to next day reuse the `day` item action,
  which puts the stop after the target day's last stop; they are disabled on Day 1 and the last day.
- Adjust schedule, Edit details, Add a comment, Schedule on a day and the time button open
  `StopPopover` (`apps/web/components/trip/timeline/StopPopover.tsx`), a `role="dialog"` attached to the
  row at every width. Escape and an outside tap close it without saving; focus returns to the row.
- Add again sends an `add` operation with a new id, the same detail, place and day and no times, so the
  server times it after the day's last stop.
- The `move` item action stays in `lib/trip/item-actions.ts` for a keyboard route to move a stop.

## Alternatives considered

- Keep the sheet on a phone: the popover is small enough at 390 px and the sheet hid the row being edited.
- Add a dedicated duplicate operation: the day-only `add` already times the stop and Undoes cleanly.

## Consequences

- The `itinerary`, `timeline`, `settle-path`, `check-entry-point` and `auto-save-places` scripts reorder
  by dropping a stop instead of choosing Move earlier or Move later.
- `stop-menu` covers every item, popover dismissal, keyboard access, accessible names and Chinese labels.

## Sources

- [Spec #743](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/743), ticket #746; builds on
  [Itinerary edits apply at once](2026-10-27-instant-itinerary-edits.md).
