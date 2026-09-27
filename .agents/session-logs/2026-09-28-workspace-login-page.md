---
date: 2026-09-28
author: Codex
branch: feature/account-settings-language
pr: none
area: apps/web, docs
contract-impact: none
---

# Split account commits and add a workspace login page

## What changed

- Committed prior work separately: `7328f0c` sidebar profile menu; `9f86d39` account modal handoff.
- Added `AuthScreen.tsx` and `auth.css`; login and registration routes share the product introduction and themed Clerk forms, with loading/failure messages.
- Middleware redirects anonymous page navigation to `/sign-in`; provider handles sign-out/session loss and Clerk redirects successful authentication to `/`.
- Added a login-gate Agent Note, cross-linked the partially superseded account note, and updated EN/ZH workspace UI and roadmap documentation.

## Why

The owner requested a standalone login page and sign-in before entering the workspace. Without Clerk configuration, the existing local workspace remains available.

## Validation

- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint`: passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `git diff --check`: passed.
- Reviewed/recorded workspace-ui and roadmap pairs. Overall pairing fails only on pre-existing untracked `docs/problem.md` (missing Chinese pair/review).
- Real browser: logout → login page; anonymous `/` and `/debug/map` → login; Google login → workspace; authenticated login/registration URLs → workspace; registration link round trip checked without submission.
- Desktop 1440 × 1000 and phone 390 × 844 checked in dark/light themes. Phone scrollWidth equals clientWidth (375; remaining 15 px is the vertical scrollbar). Primary button is 44 px tall; no current console errors.
- Repeatable steps and screenshots: ignored `output/playwright/login-page-*`. Temporary viewport and media overrides restored.

## Notes for the next person

- Preview stays open at `/sign-in`. No push or PR.
- No-key mode, auth-load failure and existing-tab expiry were inspected in code; not separately exercised. Registration completion and non-Google providers were not tested.
- Public planner API contracts are unchanged. Browser-local data remains on logout; cloud synchronization and the existing unreadable-workspace warning are outside this change.
- `docs/problem.md` remains untouched. No skill command/path/threshold changed.
