---
date: 2026-10-25
author: Claude (with Joey)
branch: feature/TP-87-explain-live-block
pr: none
area: apps/web, docs
contract-impact: api
---

# Say why live data is off on a test deployment

## What changed

- `apps/web/lib/auth/live-data.ts`: `liveDataBlock` returns why live is unavailable:
  `auth-not-configured` on a Vercel deployment without Clerk, `sign-in-required` for a signed-out
  caller when Clerk is configured, or nothing. `liveDataAllowed` and `requestDataMode` keep their
  behaviour.
- `apps/web/app/api/data-mode/route.ts`: adds `liveBlock` (`null` when live is available).
- `apps/web/lib/workspace/data-mode.ts`, `DataModeToggle.tsx`, `WorkspaceView.tsx`: the toggle uses
  `liveBlock` to pick its hint. On a deployment without auth it no longer tells the visitor to sign in,
  because no sign-in exists there. The zh strings are in `workspace-messages.ts`.
- `docs/api.md`, `docs/api.zh.md`: document `liveBlock`.

## Why

On `elec5620-ai-trip-planner.vercel.app`-style deployments (`VERCEL_ENV` set, no Clerk key) live is
refused by the 2026-10-18 guard, which is intended. The toggle, however, still said "Sign in to plan
with live hotel and flight prices", a dead end. The decision for the test deployment is to configure
Clerk there and sign in; this change does not alter the guard.

## Validation

- `pnpm --filter @trip/web typecheck`: clean.
- `pnpm --filter @trip/web lint`: exit 0 (existing warnings only).
- `pnpm --filter @trip/web test`: 57 files, 642 tests passed.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs`: no added helper-copy classes.
- Dev server with `VERCEL_ENV=preview` and no Clerk: `GET /api/data-mode` returned
  `liveAvailable: false, liveBlock: "auth-not-configured"`.

## Notes for the next person

- No E2E or redgreen record was added for the toggle copy. A real test deployment with Clerk
  (TP-63) is the place to check the signed-in and signed-out chip end to end.
- Live provider behaviour was not exercised: the sandbox has no provider keys and most provider hosts
  are unreachable.
