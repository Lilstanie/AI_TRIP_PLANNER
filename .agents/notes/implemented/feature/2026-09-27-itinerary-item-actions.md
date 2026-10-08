# Agent Note: Itinerary items are edited from a per-item action menu

Status: implemented

## Problem

The drawer's Overview listed the trip's places, but a traveller could only change one through the
Timeline tab's editor, and only its time, order, day or Google place. They could not remove a stop,
rename it, keep a note on it, set it aside for later, or record that they had booked it. The owner
asked for Overview to become Itinerary, with every item editable the way Mindtrip's item menu
allows.

## Decision

- The drawer's first tab is **Itinerary**. Each stop in `TripPlaceList` has an action menu
  (`components/ui/ActionMenu.tsx`): Adjust schedule, Edit details, Add a note, Move earlier, Move
  later, Move to ideas, Move to previous day, Move to next day, Mark as booked, Remove. A stop in **Ideas** (no day) offers
  Schedule on a day, Edit details, Add a note and Remove.
- **Contract** (`packages/shared/src/contracts.ts`): `ProposalItem` gains optional `note` (up to 500
  characters) and `booked`. An activity without `day` and times is an idea.
- Details, note, booked, remove, ideas and day moves are pure plan transforms
  (`apps/web/lib/trip/item-actions.ts`) applied at once, bumping `editVersion`; the list offers Undo,
  which restores the previous plan. A stop moved to another day or scheduled from Ideas keeps its
  duration and starts after that day's last stop (09:00 on an empty day). Adjust schedule opens the
  Timeline tab on that stop, whose edits still go through `POST /api/trip/preview-edit`.
- **Move earlier / Move later** (issue #176) reorder a stop within its day without dragging. The
  neighbour is the adjacent scheduled stop on that day by start time, the order the list shows. The
  pair swaps places: the stop that ends up first starts at the pair's earlier start time, the other
  starts when it ends or at its own later start if that is later, and each keeps its own duration.
  Both lose `arriveBy`, since their connections changed. The first stop of a day has no Move
  earlier, the last has no Move later, and an idea has neither. On phones (max-width 520px) the
  menu trigger and its items are at least 44 px, the minimum touch target.
- `previewEdit` schedules only activities with a day and keeps ideas unchanged.

Ways this can fail, written before the code: an unknown item id → the action is refused with a
message; a day outside the trip → refused; a moved stop that would run past 23:59 → refused, the
plan unchanged; a note or name over its limit → trimmed to the limit by the form, rejected by the
schema otherwise; removing the last stop of a day → the day stays with no stops; undo after the
plan changed elsewhere (chat replanning) → Undo is cleared when a new plan arrives; route checks on
a day after a move → reported by the Timeline's route check, not silently re-timed.

Ways Move earlier / Move later can fail, written before the code: the stop has no neighbour in
that direction (first or last of its day) → the menu does not offer the item, and the transform
refuses with a message if called anyway; the stop is an idea or has no start time → refused, plan
unchanged; the swapped pair's later stop would end past 23:59 or overlap the stop after the pair →
refused with a message, plan unchanged; two stops share a start time → the list's order (start time, then plan order) decides
the neighbour, so the transform uses the same order; a stop without an end time → treated as 120
minutes, as day moves do; the moved pair now overlaps the next stop → kept, and the Timeline's
checks report it rather than re-timing other stops; the plan array order drifts from time order →
the pair also swaps places in the plan so the Timeline edits in the new order; Undo after a swap →
restores the previous plan like any other action.

## Alternatives considered

**Send every action through the server preview.** Consistent with Timeline edits, but details,
notes and booking change nothing the server checks, and a preview panel per click made simple
actions slow. Actions that change schedules still have the Timeline's previewed path.

## Consequences

- Travellers shape the plan directly; the planner's next replan from chat still replaces manual
  activities, as before.
- Day moves from the menu do not re-check routes; the Timeline's route check does.
- Dated 2026-10-08: item actions (move, Ideas, details, notes, booked, remove) end with the same settle step as server
  edits (`apps/web/lib/trip/settle.ts`), so budget totals and conflicts are recomputed in the browser. A move clears the
  following stop's `arriveBy`, and the Timeline's day pass routes that day again. The first bullet above still holds.

## Sources

- The owner's review list for this session; Mindtrip's item menu as the reference.
