---
date: 2026-11-04
author: Claude (refinement sweep)
branch: fix/TP-369-first-paint
pr: pending
area: apps/web
contract-impact: none
---

# TP-369: first paint uses the browser language and the saved appearance

## What changed

- `components/account/LocaleProvider.tsx`: the browser language comes from `useSyncExternalStore`
  (server snapshot `en`, client `navigator.languages`), so the first client render is already Chinese
  for a `zh*` browser instead of switching after an effect.
- `app/layout.tsx`: a head script applies a saved `light` or `dark` appearance from `trip.settings.v1`
  before the page paints.
- `components/account/SettingsProvider.tsx`: the appearance effect waits until saved settings are
  read, so the default `system` no longer clears the head script's theme on mount.
- `tests/e2e/first-paint.e2e.mjs` (+ failures inventory); `docs/workspace-ui.md` and its pair.

## Validation

- `LABEL=before node apps/web/tests/e2e/first-paint.e2e.mjs` on `main`: 1/4 — zh browser frames
  `["New chatChat","新聊天聊天0行程0日历轨"]`, dark saved `["rgb(245, 245, 247)","rgb(0, 0, 0)"]`,
  light saved `["rgb(0, 0, 0)","rgb(245, 245, 247)"]`.
- With the locale change only: 2/4 (theme still flashed); with all three changes: 4/4.
- `pnpm --filter @trip/web exec vitest run`: 69 files, 685 tests; web `tsc` and eslint clean.

## Notes for the next person

- `sidebar-entries.e2e.mjs` still failed 1 in 8 runs; the cause is the E2E waiting on the skeleton's
  `.workspace-app`, fixed separately.
