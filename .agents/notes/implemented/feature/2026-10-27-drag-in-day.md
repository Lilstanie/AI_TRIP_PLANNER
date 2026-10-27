# Agent Note: Drag a stop within its day

Status: implemented
Owner: spec #743, ticket #748

## Problem

Reordering a day used the browser's native drag and drop on a small target. It gave no insertion line,
did not work on touch, and left no keyboard route. The spec asks for the whole row to be the target.

## Decision

- Drag is pointer-driven (`apps/web/components/trip/useItineraryDrag.ts`), not native drag and drop, so
  mouse and touch share one path. A mouse drag starts after 5 px; a touch drag after a 400 ms long
  press, and a quick swipe still scrolls. The row has no `draggable` attribute.
- Rows carry `data-drop-row` and lists `data-drop-zone` (`lib/trip/drag-target.ts`). The hook finds
  the zone under the pointer, takes the insertion index from the midpoints of the other rows, and
  passes `{ zone, index }` to `onDrop`. `TripEditor` draws one insertion line and sends one `move`
  edit, which records the usual Undo.
- Ticket #749 extends it by returning true for more zones from `accepts`, giving the Ideas list and
  other days `data-drop-zone`, and handling the new target in `onDrop`; the hook does not change.
- A drag already under way is cancelled when the trip becomes locked (assistant running or an edit
  being checked); a locked trip never starts one.
- Presses on inputs, links, forms and open menus never start a drag.
- The keyboard route is Alt+ArrowUp and Alt+ArrowDown on the focused Stop, announced by a persistent
  polite live region ("{name} moved to position {n} of {total} on Day {d}").
- The list scrolls when the pointer is within 56 px of its edge.

## Alternatives considered

- Keep native drag and drop: no touch support and no control over the insertion line.
- A drag handle: the spec removes it.
- Space to grab and arrows to move: needs a held state to announce and cancel; one Alt+Arrow press is
  one edit with its own Undo.

## Consequences

- The menu items Move earlier and Move later remain until the stop menu ticket replaces them.
- The click that ends a drag is swallowed once, so a drop never opens the Stop.
- `instant-edits` still covers a drop; `drag-in-day` covers the line, drops, touch, keyboard and locks.

## Sources

- [Spec #743](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/743), ticket #748.
