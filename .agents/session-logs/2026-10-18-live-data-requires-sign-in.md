---
date: 2026-10-18
author: Claude Opus 5 (with Ziqi He)
branch: feature/live-data-requires-sign-in
pr: none
area: apps/web, docs, scripts
contract-impact: api
---

# Live provider data now requires a session, and the public route list is an allow-list

## What changed

- `apps/web/lib/auth/live-data.ts` (new): `liveDataAllowed` and `requestDataMode`. The
  `x-trip-data-mode` header is treated as a request; a caller who may not spend the allowance is
  downgraded to `mock` instead of refused.
- `apps/web/lib/auth/public-routes.ts`: the blanket `/api(.*)` and unused `/trpc(.*)` entries are
  replaced by named routes, and `/` is public so the workspace works signed out. `/api/account/*`
  is now behind the middleware as well as its own `accountUser` check.
- `apps/web/lib/map-provider/index.ts`: `mapProviderFor(dataMode)` is the only builder; `mapProvider()`
  takes no request, so a route cannot select providers straight from a browser header.
- The six request-serving routes (`chat`, `trip/preview-edit`, three `places/*`, `routes/from-location`)
  resolve their mode through `requestDataMode`. `/api/data-mode` reports `liveAvailable`, and
  `DataModeToggle` disables the live switch with a sign-in hint when it is false.
- `scripts/verify-api-auth.mjs` + its test: every handler under `apps/web/app/api` must carry a
  declared status, checked against the patterns actually in `public-routes.ts`.

## Why

`authEnabled` is false whenever the Clerk publishable key is missing, which made the middleware a
no-op on a public deployment. Gating live data on the session alone would therefore have changed
nothing until Clerk is configured, so `liveDataAllowed` also refuses live data in a production build
that has no auth at all: the deployment degrades to fixtures rather than billing the team for
anonymous traffic.

The guard lives in `scripts/` because the root `package.json` and `.github/**` are protected files;
CI already runs `pnpm test:scripts`, so it executes without touching either.

## Validation

- `pnpm --filter @trip/web typecheck` — clean.
- `pnpm --filter @trip/web lint` — no ESLint warnings or errors.
- `pnpm --filter @trip/web test` — 57 files, 642 tests passed.
- `pnpm test:scripts` — 40 tests passed, including the five new auth-coverage checks.
- `pnpm verify:docs`, `pnpm verify:pairs` — both clean (27 pairs).

## Notes for the next person

- Issue #439 is not closed by this: Clerk and Neon still have to be configured on Vercel, and the
  fail-closed check for a production build with no auth key is deliberately a downgrade to mock, not
  a 503, so the deployment stays usable for assessment.
- No runtime test covers a real signed-in session or cross-user access (#441). CI has no Clerk test
  credentials; adding them is the remaining half of that issue.
- Per-user rate limiting (#440) is still open. Anonymous traffic can no longer spend the allowance,
  but one signed-in user still can.
