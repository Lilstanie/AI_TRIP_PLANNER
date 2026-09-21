---
date: 2026-09-21
author: Claude Code (with A)
branch: feature/data-mode-toggle
pr: none
area: apps/web, packages/tools, packages/agents
contract-impact: none
---

# Switch between mock fixtures and live providers from the top bar

## What changed

- `packages/tools/src/data-mode.ts` (new) — request-scoped mode with the
  `USE_MOCK_TOOLS` environment value as the default.
- Replaced all eleven direct `process.env.USE_MOCK_TOOLS` reads across
  `packages/tools` and `packages/agents` with `mockEnabled()`.
- `/api/chat` and `/api/hitl` honour an `x-trip-data-mode` header; new
  `/api/data-mode` reports the deployment default and whether keys exist.
- `components/workspace/DataModeToggle.tsx` + `lib/workspace/data-mode.ts` —
  top-bar button, choice remembered per browser.

## Why

The mode was a deploy-time setting: changing it meant editing Vercel env and
redeploying. It is now per request.

It is deliberately not stored by mutating `process.env`. Fluid Compute reuses
one instance across concurrent requests, so a per-request environment write
would leak between visitors — one person's "live" silently flipping another's
run. AsyncLocalStorage scopes it to a single request's async tree; a test
covers exactly that interleaving.

The toggle is visible to everyone, by A's decision. Live mode therefore lets
any visitor spend the shared SerpApi allowance, so the button names the active
mode rather than hiding it, and flags when live mode has no key behind it.

## Validation

- `pnpm test` 462/462 (5 new); `pnpm typecheck`, `pnpm lint`, `pnpm build` clean
- End to end against a local server whose env says `USE_MOCK_TOOLS=false`:
  toggling to Mock returned `Mock Tokyo Saver/Standard/Comfort`, proving the
  request overrides the environment; toggling to Live returned real properties
  (`Base Inn Tabata`, `A16 Hostel Tokyo`) with a "Live data" source badge.

## Notes for the next person

The map is unaffected: `/api/places/*` call Google directly and never consulted
this flag, so they stay broken until `MAPS_API_KEY` is set. That route also
reports a missing key as "temporarily unavailable" with a Retry button that can
never succeed — worth separating from a real outage.
