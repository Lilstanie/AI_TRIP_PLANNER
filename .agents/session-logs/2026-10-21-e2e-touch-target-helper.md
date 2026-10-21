---
date: 2026-10-21
author: Claude Code
branch: fix/e2e-touch-target-helper
pr: none
area: apps/web/tests/e2e, docs
contract-impact: none
---

# Share one rounded 44 px touch-target check across E2E scripts

## What changed

- `tests/e2e/trip-setup.mjs` exports `touchSized(pixels)`, which rounds before comparing with 44.
- 15 hand-written `>= 44` / `< 44` checks in 8 scripts use it: `agent-lab-trace`, `chat-ui-triage`, `phone-map`, `phone-mine`, `phone-sheet-targets`, `phone-shell`, `phone-touch-targets`, `trip-rename-delete`.
- The checks that ran inside `evaluate` now return sizes and compare in Node.
- `docs/development.md` (en/zh) and `find-simplifications` project patterns name the helper.

## Why

From the 2026-10-21 retro: `phone-mine` failed at 360 px on a 43.99998 px box, and the other 14 checks compared raw sub-pixel sizes the same way.

## Validation

- `pnpm --filter @trip/web e2e agent-lab-trace phone-sheet-targets phone-touch-targets trip-rename-delete chat-ui-triage phone-map`: all ok.
- `phone-mine`: the first run failed with `touchSized is not defined` inside `evaluateAll`. After the size filter moved to Node it passed (runner `2026-10-21T13-07-05-410Z.json`).
- `phone-shell`: its own checks pass; the script still exits 1 because its `phone-map` companion summary path is missing (`output/playwright/phone-map/summary.json`), which fails the same way on `main` and is tracked in #533.

## Notes for the next person

- `touchSized` runs in Node only; a browser-side `evaluate` cannot see imported helpers.
