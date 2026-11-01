---
date: 2026-11-01
author: Claude Code (for Joey)
branch: fix/TP-237-data-mode-button
pr: none
area: apps/web, docs
contract-impact: none
---

# Bring back the data-mode chip, synced with Settings (TP-237)

## What changed

- Restored `DataModeToggle` in the desktop top bar and phone Mine, with its CSS and tooltip strings.
- The chip writes the Settings `dataMode` preference (`useWorkspace` `dataMode.choose`), so the chip
  and Settings → Trip data always show the same mode; default stays live.
- Restored the E2E checks that #883 replaced; docs, ui-verification skill and the 2026-11-01 Agent Note updated.

## Why

Joey asked for the button back after #883 removed it. Writing through the Settings preference keeps
the #883 fix: no second store that overrides Settings.

## Validation

See the PR body.

## Notes for the next person

none
