---
date: 2026-09-28
author: Codex
branch: feature/account-settings-language
pr: none
area: apps/web, docs
contract-impact: none
---

# Add pointer feedback to login and registration

## What changed

- `useAuthPointerFeedback.ts` batches mouse positions in one animation frame and updates CSS variables without re-rendering Clerk's form.
- `AuthScreen.tsx` connects page/card references; `auth.css` adds a localized grid/tint, masked card-edge highlight and introduction-row hover feedback.
- Added static fallbacks for touch and accessibility preferences, plus cleanup on leave/blur/scroll/resize/hidden pages.
- Updated/reviewed both workspace UI documentation languages; no Agent Note or skill update needed for this localized visual change.

## Why

The owner requested mouse-responsive UI like DeepSeek's site. A restrained grid and existing glass edge fit the workspace tokens while keeping form controls stationary. No new dependency or external code/assets were copied.

## Validation

- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`: passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `git diff --check`: passed.
- Workspace UI translation review recorded. Overall pairing fails solely on existing untracked `docs/problem.md` (missing Chinese pair/review); file untouched.
- Browser at 1440 × 1000: positions at (300, 480) and (1140, 230) drove page/card feedback; registration feedback and input Tab order checked; no console errors.
- Reduced-motion emulation removed active flags and hid effects. Touch at 390 × 844 disabled feedback; scrollWidth/clientWidth both 375 with a 15 px vertical scrollbar.
- Dark and light desktop visuals checked. Evidence and repeatable steps under ignored `output/playwright/login-pointer-*`.
- Media/touch/viewport overrides restored; preview remains open at `/sign-in`.

## Notes for the next person

- No credentials or account details changed. Contrast/transparency/forced-colour fallback branches inspected in code; not separately emulated.
- Prior Google login/redirect coverage is in the login-page session log and ignored walkthrough.
- No push or PR. Existing unreadable-workspace and cloud-sync limitations remain outside scope.
