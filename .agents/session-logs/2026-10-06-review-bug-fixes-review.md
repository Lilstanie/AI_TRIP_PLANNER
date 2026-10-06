---
date: 2026-10-06
author: Claude Code
branch: fix/phone-shell-review-bugs
pr: 192
area: apps/web
contract-impact: none
---

# Review fixes on the combined review-bug branch (#184, #185, #187–#190)

## What changed

- `apps/web/lib/i18n/locale.ts`: `currencyDigits()` reads the ISO 4217 minor unit through `Intl`
  instead of special-casing JPY, so provider fares in other zero-decimal currencies (`KRW 1400`)
  drop their `.00` too; an unknown code keeps two digits. Display currencies are unchanged.
- `apps/web/components/trip/timeline/EditPreviewPanel.tsx`: a route error in the edit preview's route
  list goes through `notice()`, so the authored `Route unavailable` shows in Chinese; provider errors
  pass through unchanged.
- `apps/web/tests/e2e/timeline.e2e.mjs`: the fare check adds a KRW leg between a fourth stop.

## Validation

- `BASE_URL=http://localhost:3150 node apps/web/tests/e2e/timeline.e2e.mjs` (mock mode): the KRW
  checks failed on the old JPY-only rule (2 FAIL), then 34 ok, 0 failed with the fix.
- `display-currency.e2e.mjs` 50 ok and `workspace-chinese.e2e.mjs` 37 ok, both exit 0.
- `pnpm --filter @trip/web typecheck`, `lint` and vitest `tests/lib/trip tests/components/trip`
  (30 passed): clean.

## Notes for the next person

- The pairs record in `.agents/translation-pairs.json` goes stale whenever two branches that each
  re-recorded the same pair are merged; re-run `check-pairs.mjs --record` after the merge.
- `pnpm --filter @trip/web dev` hardcodes port 3000; parallel worktrees need `next dev -p <port>`.
