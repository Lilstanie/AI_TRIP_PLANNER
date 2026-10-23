---
date: 2026-10-23
author: Claude
branch: feature/team-panel-review
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Fix the code review findings on the team panel (spec #629)

## What changed

- `TeamControl` and `PhoneTeamButton` switch to the chat before a reveal when the Map is showing; they
  share `useTeamSurface`, and `TeamPanel` takes a `TeamModel`.
- `team-model.ts`: Stopped row status for cancelled or failed turns (`latestTurn` returns a `TeamTurn`
  with `interrupted`), unique hand-off ids, reasoning set instead of a rescan per start.
- `TeamControl`: a click closes an open panel; the popover is a dialog with `aria-controls`, and a
  keyboard or touch open moves focus in.
- `Composer` and `mentions.ts`: Shift+Tab does not pick, a pick updates the caret, multi-word names keep
  the menu open, the first Backspace selects the token with its space, one alias source, dead
  `insertMention` removed. `ChatPanel` counts turns with a running counter.
- E2E: `team-panel-desktop`, `team-thinking` (now also 800 px), `mention-menu` and their failure
  inventories; `docs/workspace-ui.md`, `.zh.md` and the Agent Note.

## Why

The new checks failed before the fixes (hover click pinned, Shift+Tab picked, Map press landed in a hidden
chat, cancelled turns read Done). A click that closes a hover-opened panel means a mouse cannot pin it;
Enter and touch still do.

## Validation

See the report for this branch; commands are listed there.

## Notes for the next person

- Duplicate-key coverage needs the dev server; a production build drops the React warning.
