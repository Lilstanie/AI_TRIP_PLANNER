---
date: 2026-11-01
author: Claude Code (for Ziqi He)
branch: feature/TP-234-admin-passcode
pr: none
area: apps/web, docs
contract-impact: none
---

# Admin passcode on /sign-in opens the workspace without a Clerk account (TP-234)

## What changed

- `apps/web/lib/auth/admin-token.ts`, `admin.ts`: passcodes `admin`, `test`, `tutor` (any case) and an
  HMAC-signed `trip_admin` cookie (12 h); `isAdminRequest()` reads it and is false outside a request.
- `app/sign-in/actions.ts`, `components/account/PasscodeForm.tsx`, sign-in page: the passcode form
  shows below Clerk sign-in, and alone when Clerk is not configured.
- `middleware.ts`, `lib/auth/live-data.ts`, `AccountProvider` (via `app/page.tsx` and `Workspace`): an
  admin session passes the sign-in gate, gets live data, and runs as a local (no-account) workspace.
- `docs/demo-runbook*.md`, `docs/api*.md`: the passcode and its effect on `liveAvailable`.

## Why

A tutor may not be able to sign in through Clerk at the Week 13 demo, and a production build without
Clerk keys serves mock data only. A server action under `/sign-in` avoids adding an `/api` route.

## Validation

- `vitest run` in apps/web: 60 files, 662 tests passed (14 new in `tests/lib/auth/admin-token.test.ts`).
- `pnpm typecheck`, `pnpm lint` (existing warnings only), `node scripts/verify-api-auth.mjs`: pass.
- `pnpm build` then `start` without Clerk keys, driven in Chrome: `admin`, `TEST`, `Tutor`,
  `"  tutor  "` reach `/` with live data; `wrong` and `admin1` stay on `/sign-in?passcode=wrong`; a
  forged cookie gets `liveAvailable: false`.
- `pnpm verify:docs`, `pnpm verify:pairs`: pass.

## Notes for the next person

- Not run with Clerk keys: the middleware bypass and the AccountProvider local branch are untested there.
- The passcodes are public in the repository; anyone can spend provider quota on a public deployment.
  Remove or gate the feature after the demo.
