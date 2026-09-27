---
date: 2026-09-27
author: Codex
branch: feature/account-settings-language
pr: none
area: apps/web, docs
contract-impact: none
---

# Verify signed-in account interactions and fix modal handoff

## What changed

- `WorkspaceDialogs.tsx` closes the native Settings dialog synchronously before opening Clerk.
- `SettingsDialog.tsx` routes sign-in, sign-up, profile-photo and account-management actions through that handoff.
- Updated both `docs/workspace-ui.md` languages and reviewed their translation record.
- Saved screenshots and a repeatable walkthrough under ignored `output/playwright/account-login-*`.

## Why

Clerk's DOM portal was behind the native modal dialog, making login controls inaccessible.

## Validation

- Real browser: Google login as Eggy Oldgoose, sign out, then login again succeeded.
- Desktop: avatar/name, profile, account, personalization, language and connected-account entry points checked; Home/End/ArrowDown/Escape/Tab and focus return checked.
- Phone 390 × 844: signed-in menu, language entry and account-modal handoff checked; scrollWidth 390. Restored default desktop viewport afterward.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint`: passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `git diff --check`: passed.
- Translation review recorded for workspace-ui; overall pair check fails solely on pre-existing untracked `docs/problem.md` (missing Chinese counterpart/review).

## Notes for the next person

- Final preview remains signed in at localhost:3000; no account details or settings saved.
- Unreadable-workspace warning remains; no storage was cleared and cloud-history sync was not verified.
- Browser console includes older hot-reload errors; current Clerk development-key warning remains.
- No push or PR. No Agent Note or skill update needed for this localized bug fix.
