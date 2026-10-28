# Quiet stop rows: failure inventory

Written before the code (#760, spec #755). Each line is a way the feature could fail. The agreed seam is the real Trip workspace in a browser at 1440x1500 with a mouse and at 390x844 with touch, plus 1440x1500 in Chinese, on a saved fixture Trip. The fixture holds a confirmed stop with a price, a confirmed stop with no price, a stop whose price needs checking, two stops with overlapping times, a stop with no time, an unscheduled idea, a flight row and a stay row. It covers what the traveller sees and the computed styles of the page.

## Status tags

- "Place confirmed", "Planned" or "Price needs checking" still renders on any stop, in the English or the Chinese page.
- The tag is hidden by CSS but still in the accessibility tree.
- A stop marked Visited or Skipped loses its progress, or "Planned" is shown again after marking a stop back to planned.
- A stop whose price needs checking shows no price at all instead of the price.

## Right column

- An unpriced stop shows nothing in the right column instead of "Price unknown".
- A priced stop shows "Price unknown", or the price is shifted onto the name line.

## Fills

- The time cell has a grey fill in its resting state, because the generic button rule outranks the time cell rule.
- The time cell fill returns on hover, while its popover is open, on keyboard focus or when the trip is locked.
- A stop with no time shows an empty or filled cell where the dash should be.
- The flight, stay or transfer icon keeps a filled or bordered circle in light or dark appearance.
- The idea icon keeps a filled circle.
- The numbered stop marker loses its fill by accident while the icons are changed.

## Interaction kept

- The time no longer changes colour on hover or while its popover is open.
- Keyboard focus on a time shows no focus ring.
- The time cell shrinks below the touch target on a phone.

## Open problems

- A stop with a time conflict stops appearing in the Open item badge now that tags are gone.
- The conflict list under the stop disappears.

## Helper sentence

- "Drag a stop to reorder the day, or select it to edit." still renders on a day with several stops, on desktop or phone.
- A day with one stop or no stops gains a gap or a different ending, so the day does not end on its Add button.

## Dead strings and styles

- "Place confirmed", "Price needs checking" and the sentence stay in the message catalog with their Chinese translations after nothing uses them.
- `.timeline-day__tip`, `.timeline-tag--ok` or the fill rules stay in CSS after nothing uses them.
- A document under `docs/` still describes the tags or the sentence.
- Another E2E script still waits for a removed tag.

Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pw-shim pnpm --filter @trip/web e2e quiet-stop-rows --prod`. The script writes `result.json` and screenshots to `apps/web/output/playwright/quiet-stop-rows/<EVIDENCE_LABEL>/` (default `after`).
