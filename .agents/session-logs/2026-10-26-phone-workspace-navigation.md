---
date: 2026-10-26
author: Codex
branch: feature/TP-98-phone-navigation
pr: none
area: apps/web, docs
contract-impact: none
---

# Put the planning journey first in phone navigation

## What changed

- Moved Trajectory from the bottom tab bar into a full-screen Agent Team modal.
- Updated phone Chat, Map, Trip and Mine navigation, including the empty-workspace order.
- Reordered Mine around search, saved Trips, chats, creation actions and one settings entry.
- Added fixture browser evidence for navigation, focus, Browser Back, EN/ZH and breakpoint changes.

## Why

Trajectory occupied primary navigation space even though planning happens in Chat, Map and Trip.
The accepted [navigation decision](../notes/implemented/feature/2026-10-26-phone-workspace-navigation.md)
keeps its full ledger and specialist workflow one step away without weakening the planning journey.

## Validation

- `pnpm --filter @trip/web e2e phone-navigation`: 233/233 checks passed; artifact
  `output/e2e/runner/2026-10-25T14-55-39-825Z.json`, report
  `output/playwright/phone-navigation/summary.json`.
- `pnpm --filter @trip/web test`: 57 files and 642 tests passed.
- Web typecheck and lint passed (lint retained an existing exhaustive-deps warning).
- UI copy checker, `verify:docs`, `verify:pairs`, `verify:protected`, E2E selector and artifact
  checks, changed-file formatting and the added-comment check passed.

## Notes for the next person

Browser viewport simulation does not prove a physical keyboard, installed-app safe areas or live
provider behavior.
