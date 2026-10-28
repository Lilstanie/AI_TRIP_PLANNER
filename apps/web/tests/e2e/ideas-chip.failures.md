# N ideas chip and legs without Show distances: failure inventory

Written before the code (#761, spec #755). Each line is a way the feature could fail. The agreed seam is the real Trip workspace in a browser at 1440x1500 with a mouse, at 390x844 with touch and at 1440x1500 in Chinese, a saved fixture Trip with parked places and a leg between two stops, and the mock edit route. It covers what the traveller sees and the saved plan.

## Ideas section removed

- An Ideas heading, list or Add to Ideas button still renders above Day 1, or is hidden by CSS but still in the accessibility tree.
- A restaurant suggestion that used to appear in the Ideas section now appears nowhere, or inflates the chip count.

## Chip

- The chip shows the wrong count, a count of scheduled stops, or a stale count after a stop is parked, scheduled or Undone.
- With zero ideas the chip renders.
- With one idea the label reads "1 ideas" or is not translated in Chinese.
- The chip has no accessible name, is not a button, or is under 44 px on a phone.
- Pressing the chip does not open the Add to trip panel, opens it on Search instead of Ideas, or opens it for no day.
- Choosing an idea from the opened panel does not schedule it on the selected day, or offers no Undo.
- The chip stays enabled on a locked trip or while the assistant is running and an edit request is sent.
- The panel opened from the chip stays open after the selected day changes.

## Drop target

- Dragging a stop does not mark the chip as a drop target, or the marker stays after the drop or Escape.
- Dropping a stop on the chip changes nothing, or sends more than one idea edit, or keeps the stop's times.
- The drop gives no Undo, or Undo leaves the saved plan different from before, or the chip count is not restored after Undo.
- Dropping an idea on the chip does something other than nothing.
- A drop on the chip during an assistant revision or on a locked trip still unschedules the stop.
- Move to ideas in the stop menu no longer works.
- Parking the last idea's neighbour by drag shifts the layout so the drag lands on the wrong day.
- With zero ideas a stop cannot be parked by drag; Move to ideas is the route, and the chip still appears at once after it.

## Show distances

- A Show distances switch, its label or its Chinese string still renders.
- A leg line loses its distance, mode or Directions link.
- A browser that stored `trip.show-distances.v1` as "0" still hides legs, so the old preference is still read.
- The old preference is written again by any control.
- The `useShowDistances` hook, the storage key constant or the `showDistance` prop stay in the source.

## Labels and phone

- The new chip label has no Chinese translation, or the Chinese accessible name differs from the visible label.
- "Show distances", "Add to Ideas" or the Ideas section strings stay in the message catalog after nothing uses them.
- On a phone the chip overflows the screen or crowds the budget line.
- A document under `docs/` still describes the Ideas section or the Show distances switch.
- Another E2E script still looks for the Ideas section or the switch.

Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pw-shim pnpm --filter @trip/web e2e ideas-chip --prod`. The script writes `result.json` and screenshots to `apps/web/output/playwright/ideas-chip/<EVIDENCE_LABEL>/` (default `after`).
