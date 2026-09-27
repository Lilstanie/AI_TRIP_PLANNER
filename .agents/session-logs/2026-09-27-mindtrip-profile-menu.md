---
date: 2026-09-27
author: Codex
branch: feature/account-settings-language
pr: none
area: apps/web, docs
contract-impact: none
---

# Match the sidebar account row and menu to Mindtrip

## What changed

- `AccountButton.tsx`: avatar and two-line identity row, horizontal overflow trigger, profile card, grouped settings links and signed-in Sign out action.
- `AccountProvider.tsx`: expose the existing Clerk username for the secondary identity line when available.
- `workspace-navigation.css`: full-width footer row, menu above the row, side placement when collapsed and phone touch targets.
- Updated both workspace UI documents and their translation-pair record.

## Why

The supplied Mindtrip screenshot places identity and settings together in the bottom corner. Menu actions use existing settings sections; unsupported Mindtrip services are omitted.

## Validation

- `pnpm typecheck` and `pnpm lint` passed; final web-only typecheck and lint also passed after the component changes.
- `pnpm verify:docs`, `pnpm verify:protected` and `git diff --check` passed.
- Browser: 1440 × 1000 desktop and 390 × 844 phone layouts; phone document width was 390, with no horizontal overflow.
- Keyboard: arrows navigate; Language & region opens its settings section. Signed-in profile opens Edit profile; Escape returns focus to the overflow trigger.
- Signed-in menu includes full name, avatar and Sign out; sign-out was not activated. Collapsed menu position stays within the viewport.
- Screenshots: `output/playwright/account-menu-desktop.png` and `output/playwright/account-menu-phone.png` (ignored artifacts).
- Translation-pair record updated for both workspace UI docs. Overall pairing check still reports the pre-existing untracked `docs/problem.md` lacks its Chinese pair.

## Notes for the next person

- Dev preview remains running at http://localhost:3000 for user review.
- The in-app browser reports an existing unreadable-workspace warning; no storage replacement was performed.
