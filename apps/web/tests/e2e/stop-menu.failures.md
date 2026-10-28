# Stop menu and in-place popovers failure inventory

The agreed seam is the real Trip workspace in a browser at 1440x900 and 390x844 (and 1440x900 in Chinese) with a saved fixture Trip, stubbed place search and details, and the mock edit route. It covers what the traveller sees and the saved plan. It does not establish live-provider behaviour.

Every menu item is checked for three things: it takes effect at once, the saved plan changes as named, and Undo restores the saved plan.

- The Stop menu still lists Move earlier, Move later and Move to another day, and lacks Add again and Move to previous day or Move to next day.
- Add a note is still named that way and Add a comment is missing from the Stop and Idea menus.
- Move to previous day is enabled on Day 1, or Move to next day is enabled on the last day, and selecting it produces an error instead of being unavailable.
- Move to next day into a day with no room changes the plan or fails without a notice.
- Add again replaces or merges with the existing stop, drops its place, or leaves no Undo.
- Adjust schedule is missing, or Adjust schedule, Edit details, Add a comment or Schedule on a day open inside the selected place card, a modal sheet on a phone, or a full page instead of a popover attached to the row.
- Tapping the time opens a different editor from Adjust schedule.
- A popover stays open after Escape or an outside tap, or saves what was typed when it closes.
- A popover cannot be opened from the keyboard, does not take focus, or does not return focus to the row on close.
- A popover control (field, Save, Cancel, day select) has no accessible name.
- Tapping a row opens a popover instead of place details.
- An Idea menu offers stop-only actions such as Move to previous day or Add again, or lacks Schedule on a day, Edit details, Add a comment or Remove.
- Any of the new labels shows English in Chinese.

Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pw-shim pnpm --filter @trip/web e2e stop-menu --prod` for English and `E2E_LANGUAGE=zh` for Chinese. The script writes `result.json` and screenshots to `apps/web/output/playwright/stop-menu/<EVIDENCE_LABEL>/` (default `after`).
