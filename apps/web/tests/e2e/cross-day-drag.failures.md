# Drag stops across days and onto the ideas chip: failure inventory

Written before the code (#749, spec #743). Each line is a way the feature could fail. The agreed seam is the real Trip workspace in a browser at 1440x1500 with a mouse and at 390x844 with touch, a saved fixture Trip (Day 1 four stops, Day 2 one stop, Day 3 empty, Day 4 a late stop, one idea) and the real edit route. It covers what the traveller sees and the saved plan.

## Where the ideas chip sits

- The ideas chip is below the day list or the Add control, not above Day 1, on desktop or on the phone.
- The chip moves the day down while a drag is under way, so the line and the target drift.

## Stop to another day

- A day in the day strip is not a drop target, so a Stop cannot reach a day that is not on screen.
- Dropping on an empty day does nothing, or reports "Invalid activity position".
- Dropping on a day chip puts the Stop first or in the middle instead of at the end of that day.
- Holding a dragged Stop over a day chip does not open that day, so a position inside it cannot be chosen.
- After the day opens during the drag the insertion line is missing, or sits in the day the drag started from.
- A drop on another day is sent as several edits, or without one Undo entry.
- Undo restores the Stop but leaves the old day, times or order in the day it left or the day it joined.
- After the drop the Stop numbers, the times or the Directions links of either day still show the old order.
- Dropping a Stop on a day in another accommodation segment, or on a day with no room, changes the plan instead of showing the refusal.
- Dropping a Stop on its own day chip, or on its own place, sends an edit.

## Stop to the chip

- Dropping on the ideas chip does nothing, or deletes the Stop.
- The Stop keeps its day or times after it is an idea.
- No highlight shows the chip as the target while dragging.
- Undo of the drop leaves the Stop an idea, or returns it without its day and times.
- The day it left still shows its number, or its neighbours still show a Leg to it.

## Locks and interruptions

- A trip locked by a running assistant still starts a cross-day drag or sends an edit when dropped.
- A drop released while another edit is being checked sends a second edit.
- Escape during a drag over a day chip applies the drop, or leaves the day it opened selected with a line showing.
- Releasing outside every day chip and the ideas chip changes the plan.
- Releasing over the part of a Day chip that is scrolled out of the strip, where no chip shows, drops the Stop on that day.

## Touch

- A swipe over the day strip starts a drag.
- A long-press drag onto a day chip or onto the ideas chip scrolls the page instead.

Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pw-shim pnpm --filter @trip/web e2e cross-day-drag --prod`. The script writes `result.json` and screenshots to `apps/web/output/playwright/cross-day-drag/<EVIDENCE_LABEL>/` (default `after`).
