---
date: 2026-10-21
author: Claude Code for Joey
branch: fix/home-base-origin
pr: none
area: apps/web
contract-impact: none
---

# A blank chat follows the profile's home base

## What changed

- `apps/web/lib/workspace/session.ts` (`defaults-changed`), sent from `useWorkspace.ts`: when the
  profile defaults change, including on
  load, a chat with no plan, messages or typed input whose facts still equal the previous defaults
  takes the new ones.
- `apps/web/lib/workspace/workspace.ts`: `sameDraft()` compares two drafts, treating empty values
  alike.
- `apps/web/tests/e2e/profile-home-base.e2e.mjs`: saves Location in Edit profile, then checks the
  open chat, the chat restored after a reload, a new chat, the chat request, and that a started
  chat keeps its origin when the location changes again.

## Why

#511: the chat restored after a reload was created before the location was saved, so its Where
editor stayed empty and the planner asked where the traveller starts. "New chat" already used the
profile; the restored blank chat did not.

## Validation

- `pnpm --filter @trip/web e2e profile-home-base --prod`: the restored-chat check failed before,
  all five pass after.
- `pnpm --filter @trip/web e2e account-revisions phone-mine calendar-trip-identity-search --prod`:
  pass. `phone-state` ("reload restores Map") and `check-entry-point` (check 4) fail the same
  way on `origin/main` without this change.

## Notes for the next person

The two failures above are pre-existing on main.
