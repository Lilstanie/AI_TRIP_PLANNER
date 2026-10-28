# Drag a stop within its day: failure inventory

Written before the code (#748, spec #743). Each line is a way the feature could fail. The agreed seam is the real Trip workspace in a browser at 1440x1500 with a mouse and at 390x844 with touch, a saved fixture Trip and the real edit route. It covers what the traveller sees and the saved plan.

## Starting a drag

- Pressing the name, the time, the cost or the empty part of a row does not start a drag; only a small area does.
- Pressing the menu button or the time button starts a drag but the release then opens the menu or the time form.
- A drag released over the row it started on still opens the place details, or a plain click no longer opens them.
- Pressing inside an open editor field (details, note, time, search) starts a drag instead of selecting text.
- A mouse press with a secondary button starts a drag.
- A trip locked by a running assistant still shows a drag, or sends an edit when dropped.

## The insertion line

- No insertion line shows while dragging, or it shows in two places at once.
- The line sits on the wrong side of the target: before the row when the pointer is in its lower half, or after it when the pointer is in its upper half.
- The line stays on screen after a drop, Escape, a cancelled touch or a release outside the list.
- The line shows for a position the drop would not take, such as another day or Ideas, which this ticket does not support.
- The line appears under a Leg or between a stop and its Leg instead of between two stops.

## Dropping

- Dropping on the dragged row itself, or in the gap right next to it, sends an edit request or changes the saved plan.
- Dropping below the last row places the stop in the middle, or does nothing.
- Dropping above the first row places the stop second.
- Releasing outside the day list changes the plan.
- Escape during a drag leaves the drag running or applies the drop.
- A drop is applied as several edits, or without the one Undo entry.
- Undo restores the stop but not the order, the times or the numbering.
- After a drop the Stop numbers, the times or the Directions links of the Legs still show the old order.
- The assistant starts a revision while a drag is under way and the release still sends an edit.
- A second drop while the first edit is still being checked sends overlapping edits.

## Touch

- A swipe to scroll the list starts a drag, or a drag started by a long press scrolls the page instead.
- A long press does not start a drag, or starts it before the press is long.
- A long press opens the browser context menu or selects text.
- Releasing a long press without moving opens the place details.
- A held touch drag in the middle of the list pans the page or is cancelled by the browser.

## Keyboard

- There is no keyboard way to reorder a stop within a day.
- The keyboard reorder moves the stop but nothing announces the new position to assistive tech.
- Moving the first stop up or the last stop down sends an edit or announces a move that did not happen.
- Focus leaves the stop after a keyboard reorder.
- The shortcut works while the trip is locked.
- The keyboard reorder offers no Undo.

Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pw-shim pnpm --filter @trip/web e2e drag-in-day --prod`. The script writes `result.json` and screenshots to `apps/web/output/playwright/drag-in-day/<EVIDENCE_LABEL>/` (default `after`).
