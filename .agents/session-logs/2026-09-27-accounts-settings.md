---
date: 2026-09-27
author: Claude Code
branch: feature/accounts-settings
pr: none
area: apps/web, docs
contract-impact: api
---

# Optional accounts (Clerk + Neon) with sync, and a Settings dialog

## What changed

- Clerk (`clerk init`), made optional: `lib/auth/config.ts`, `middleware.ts`, `app/layout.tsx`,
  sign-in and sign-up routes. Neon via Drizzle: `lib/db/`, `drizzle.config.ts`, `drizzle/0000_*.sql`.
- Account routes `app/api/account/` (settings, sync, export, delete); `lib/account/` for settings,
  sync wire format and the catalog merge; `components/account/` for the providers, sync hook,
  account button and Settings dialog (travel profile, memberships, general, account).
- New chats start from the travel profile; `isUntouchedConversation` compares with those defaults.
  Appearance sets `data-theme`, honoured by tokens, glass, segmented controls and the map.
- `tests/e2e/settings.e2e.mjs` (new). Docs in English and Chinese: development, api, workspace-ui,
  roadmap. Agent Note `2026-09-27-accounts-settings-sync.md`.

## Why

Requested by the owner of this session. See the Agent Note.

## Validation

- `pnpm --filter @trip/web test`: 371 passed; typecheck and lint clean; migration applied to the
  Neon `dev` branch; account routes return 401 signed out.
- `settings.e2e.mjs`: all checks pass at 1440 and 390 px.
- Signed-in sync: not yet verified — needs a person to sign in through Clerk.

## Notes for the next person

A Neon `dev` connection string was printed once in a tool output while creating the branch; its
password was reset immediately. `docs/problem.md` is the owner's working list and is not committed.
