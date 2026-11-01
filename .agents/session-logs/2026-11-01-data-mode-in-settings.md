---
date: 2026-11-01
author: Claude Code (for Joey)
branch: fix/TP-231-data-mode-in-settings
pr: none
area: apps/web, docs
contract-impact: api
---

# Trip data in Settings is the only data-mode control (TP-231)

## What changed

- Removed `DataModeToggle` from the desktop top bar and phone Mine, with its CSS and tooltip strings.
- `useDataMode` derives the mode from the Settings Trip data preference (`/api/data-mode` `configured` for site default, mock when live is not allowed); the `trip.dataMode` browser key is gone.
- Settings → Language & region → Trip data shows on every deployment; Live prices only when `liveAvailable`.
- Reverted #874's `DATA_MODE_TOGGLE` / `switchable` gating; the server honours `x-trip-data-mode` again.
- E2E scripts that used `.data-mode` now assert the chip is absent; docs, ui-verification skill and an Agent Note updated.

## Why

Joey (decision card, 2026-11-01): the switch belongs in Settings and stays available on the live site.
Before this, a stored chip choice silently overrode the Settings preference.

## Validation

See the PR body.

## Notes for the next person

A signed-out visitor on a Clerk deployment sees only site default and sample data.
