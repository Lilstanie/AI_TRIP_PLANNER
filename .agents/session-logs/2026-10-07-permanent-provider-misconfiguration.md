---
date: 2026-10-07
author: Claude Opus 5 (with A / @Lilstanie)
branch: fix/permanent-provider-misconfiguration
pr: none
area: apps/web
contract-impact: none
---

# A missing Google key stops asking the traveller to retry

## What changed

- `apps/web/lib/integrations/google.ts`: `GoogleNotConfiguredError`, thrown by `key()` in place of
  a bare `Error`.
- `apps/web/app/api/places/{search,details,photo}/route.ts`: that error answers 503 with
  "Google Places is not set up for this app." Upstream failures keep their 429 and 502 mapping.
- `apps/web/lib/i18n/workspace-messages.ts`: the new string, plus Chinese for the two existing
  provider messages, which were reaching Chinese users in English.
- `docs/api.md` and `docs/api.zh.md`: 503 listed for all three routes.
- One case added to the existing `places/search` route test, which already covers this route's error
  mapping.

## Why

`key()` threw a plain `Error`, so the routes could not tell a deployment with no key from a provider
outage. Both became "Google Places is temporarily unavailable. Please retry." A missing key is
permanent: the traveller could retry forever, and nothing in the message told an operator what to
fix. 503 says the deployment is at fault rather than the request.

## Validation

`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm verify:docs`, `pnpm verify:protected` and the
translation pairing check clean. `pnpm test` 990/990.

Not exercised against a real keyless deployment: the local server has `MAPS_API_KEY`, so the new
branch is covered by the route test rather than by a live request.

## Notes for the next person

- `/api/routes/from-location` still returns `error.message` directly, so a missing key leaks the
  variable name to the traveller. Left alone here because fixing it changes that route's whole error
  shape, not just one branch.
