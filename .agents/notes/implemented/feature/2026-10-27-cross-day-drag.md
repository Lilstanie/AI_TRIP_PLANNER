# Agent Note: Drag stops across days and to or from Ideas

Status: implemented
Owner: spec #743, ticket #749
Superseded in part: the always-shown Ideas section above the day strip and dragging an Idea out, by [Ideas as an "N ideas" chip](2026-10-28-ideas-chip.md).

## Problem

A Stop could only be reordered inside its day. Moving it to another day or parking it needed the menu,
Ideas could not be dragged, and Ideas sat below the days where parked places were easy to miss.

## Decision

- The itinerary shows one day at a time, so the day strip is the way to reach the other days. Each tab
  carries `data-drop-zone="day:N"` and `data-drop-end`; the drag hook (`useItineraryDrag.ts`) returns
  `END_OF_DAY` as the index for such an element, and `accepts` and `onDrop` in `TripEditor` decide what
  it means. The hook gained only that index rule and listeners on the pressed row as well as on
  `window`, so a touch drag still ends when the day changes and the row is unmounted.
- Holding a dragged Stop or Idea over another tab for 600 ms opens that day, so the insertion line can
  choose any position. The dragged row is not drawn after the day changes; the line and the outlined
  tab mark the target.
- A Stop dropped on a day is one `move` edit; on Ideas, one `idea` edit; an Idea dropped on a tab or the
  open day is one `schedule` edit, which times it after the day's last Stop. The line for an Idea is
  therefore drawn at the end of the day. Each records one Undo. Dropping a Stop on its own tab, an Idea
  on Ideas or anything outside a target sends nothing.
- The `idea` item action now moves the Stop to the end of the plan's items, so a parked Stop is the
  last Idea and the Ideas line at the end is truthful. The menu's Move to ideas behaves the same.
- Ideas moves above the day strip and is always rendered, with a minimum height, so there is a target
  when no Idea exists. Restaurant suggestions are not draggable, because they are not plan items.
- Server refusals stand: a day without room, a move across accommodation segments and a locked trip
  show the usual notice or do nothing.

## Alternatives considered

- Render every day in one column: a larger rewrite that overlaps the stop menu and Add tickets.
- Add an index to `schedule` so an Idea lands mid-day: needs a server and shared-contract change for a
  position the traveller can change with a second drag.
- Ghost clone of the dragged row after the day changes: needs styles outside the list; deferred.

## Consequences

- An Idea cannot be dropped at a chosen position in a day; it lands last.
- `cross-day-drag` covers day, Ideas and Idea drops on desktop and phone; `drag-in-day` and
  `instant-edits` still cover the rest.

## Sources

- [Spec #743](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/743), ticket #749.
