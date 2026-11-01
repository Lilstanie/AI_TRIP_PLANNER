---
date: 2026-11-01
author: Claude Code (for Joey)
branch: fix/TP-252-admin-sign-out
pr: none
area: apps/web, docs
contract-impact: none
---

# Admin passcode sessions can sign out

## What changed

- `app/sign-in/actions.ts`: new `signOutAdmin` server action deletes the `trip_admin` cookie and
  redirects to `/sign-in`.
- `AccountProvider.tsx`: the `local` account gains an optional `signOut`; admin sessions get
  `signOutAdmin`.
- `AccountButton.tsx` and `SettingsDialog.tsx` (Account section) show **Sign out** whenever the
  account has a `signOut`, not only for Clerk accounts.
- `docs/demo-runbook.md` and `.zh.md` mention the sign-out.

## Why

The passcode session renders the workspace as the `local` account, which had no `signOut`, and the
menu only offered sign-out to `signed-in` (Clerk) accounts. Nothing ever cleared the cookie, so the
session lasted the full 12 hours.

## Validation

- `pnpm --filter @trip/web typecheck` and `lint`: pass.
- `vitest run tests/lib/account/sync-client.test.tsx tests/lib/auth`: 42 passed.
- Local `next dev` with a placeholder production Clerk key, Playwright: passcode `admin` sets the
  cookie, the account menu shows Sign out, clicking it lands on `/sign-in` and the cookie is gone.

## Notes for the next person

The admin session still shows as "Local" in the account button.
