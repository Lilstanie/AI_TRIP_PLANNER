# Agent Note: One itinerary column that edits at once

Status: implemented
Owner: spec #743, ticket #751
Superseded in part: the Show distances switch, by [Ideas as an "N ideas" chip](2026-10-28-ideas-chip.md).
See also: [Quiet itinerary panel walkthrough](2026-10-28-quiet-panel-walkthrough.md).

## Problem

The [Trip redesign](2026-10-26-trip-redesign.md) of 2026-10-26 made the itinerary ask permission at
every step. Adding a place showed a preview with an editable suggested time and waited for a confirm;
a half-filled form was kept as a draft, listed in a banner and guarded by a discard dialog on every
device size; stop editors opened as sheets or full pages; moving a stop meant a small handle or separate
Move earlier and Move later items. The traveller wanted the itinerary to work like Mindtrip's: one
column, every row draggable, one menu per stop, and each edit simply taking effect. Seven tickets
(#744 to #750) changed the code; this note records the decision they share and what it overturns.

## Decision

- The itinerary no longer confirms before saving. Every edit applies as one plan revision and pushes an
  Undo entry; removing a day, Clear day, Move all events to ideas and Remove all scheduled events are
  covered by Undo, not by a dialog. This restores the no-confirmation rule of the
  [immediate timeline edits](2026-10-08-immediate-timeline-edits.md) decision.
- The parts of the Trip redesign that this supersedes for the itinerary:
  - confirm before saving an added Stop, the editable suggested time range and Save as Idea, replaced by
    the [Add to trip panel](2026-10-27-add-to-trip-panel.md);
  - draft protection on all device sizes, the retained-input rule across day, view and width changes, the
    way back to an unfinished edit, and failed-save retry or stale-edit handling for itinerary forms;
  - the discard confirmation on Escape, Back and outside dismissal of a Stop form, and the "Unfinished
    trip edits" banner ([instant edits](2026-10-27-instant-itinerary-edits.md));
  - bottom-sheet and full-page Stop editors, replaced by in-place popovers on the row
    ([stop menu](2026-10-27-stop-menu-popovers.md));
  - the small drag handle and the Move earlier and Move later items, replaced by dragging the whole row
    ([drag in a day](2026-10-27-drag-in-day.md), [across days](2026-10-27-cross-day-drag.md)).
- The rest of the redesign stands: the dedicated Trip workspace and linked map, day navigation, compact
  budget, the open-items badge, the explicit Replan trip consent before a replan can replace manual
  edits, and discard confirmation on the Brief sheets, which are not itinerary edits.
- A trip locked by a running assistant still disables every itinerary edit, drag and Add button.
- The [day menu and itinerary menu](2026-10-27-day-menus.md) and the per-Leg distance with its Directions
  link and Show distances switch complete the interaction, with Edit title and Add note on each day.
- One E2E walkthrough, `itinerary-walkthrough`, runs the whole journey at desktop, phone and in Chinese
  and leaves screenshots and `result.json` under `output/playwright/itinerary-walkthrough/`.

## Alternatives considered

- Keep draft protection for forms that hold several fields: it keeps the permission step the traveller
  asked to lose, and Undo already covers a wrong save.
- Keep sheets on the phone only: the same menu and popover on every size was the request, and one code
  path is cheaper to verify.
- Edit the 2026-10-26 note to match the new behaviour: a reversed decision gets its own note; the old one
  still owns the parts above that stand.

## Consequences

- A wrong edit costs one Undo, and an abandoned form is simply gone; there is no draft to find again.
- Undo is the existing single step, so a second edit replaces the first Undo.
- A traveller cannot choose a time while adding; the time is set from the stop afterwards.
- The Trip redesign's failure inventory rows on dirty-field retention, discard choice and stale-save
  recovery no longer apply to the itinerary; the per-ticket E2Es and the walkthrough own the new contract.

## Sources

- [Spec #743](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/743), tickets #744 to #751.
- [Trip redesign](2026-10-26-trip-redesign.md), [open items badge](2026-10-27-open-items-badge.md).
