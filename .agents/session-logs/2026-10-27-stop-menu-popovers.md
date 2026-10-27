---
date: 2026-10-27
author: Claude Code
branch: feature/TP-124-stop-menu
pr: none
area: apps/web, docs
contract-impact: none
---

# One Stop menu and in-place popovers

## What changed

- `TimelineStop.tsx`: new menu (Adjust schedule, Edit details, Add a comment, Move to ideas, Move to
  previous or next day, Add again, Remove); Idea menu trimmed to four items.
- `StopPopover.tsx` and `StopForms.tsx`: the time, details, comment and schedule forms open in a dialog
  attached to the row instead of the place card or a phone sheet.
- `workspace-messages.ts`: removed the Move earlier, Move later, Move to another day, Edit note and
  Note strings; added Add a comment, Comment and Add again with Chinese.
- `stop-menu.e2e.mjs` and `stop-menu.failures.md`; older scripts moved to the new labels and drops.
- Docs: `workspace-ui` pair and the Agent Note `2026-10-27-stop-menu-popovers.md`.

## Why

The ticket asks for one menu and popovers; see the Agent Note.

## Validation

See the pull request report for the commands and results.

## Notes for the next person

The `move` item action is unused by the UI until a keyboard route for moving a stop lands.
