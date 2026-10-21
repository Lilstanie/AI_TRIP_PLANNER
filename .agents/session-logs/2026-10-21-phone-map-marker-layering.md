---
date: 2026-10-21
author: Codex
branch: fix/phone-touch-targets-460-461
pr: 470
area: apps/web, docs
contract-impact: none
---

# Keep phone map markers below place details

## What changed

- `apps/web/app/styles/phone-map.css` isolates the phone map renderer stacking context.
- `apps/web/tests/e2e/phone-map.failures.md` records the reproduced transition failure and retests.
- `docs/workspace-ui.md` and `.zh.md` document marker ordering beneath the phone details sheet.
- Integrated current `origin/main` at `43c7352c` (includes merged PR458 and PR448).

## Why

After the 521/1440 px viewport transitions, a real OSM marker label painted over the phone details close control and intercepted an ordinary click at 400 px. A fresh 400 px page did not reproduce it. Isolating the map renderer contains marker stacking beneath the sibling details sheet.

## Validation

- Before fix: OSM runner `2026-10-20T12-27-54-458Z` failed at 400 px after viewport transitions; marker label intercepted the visible close button.
- OSM runner `2026-10-21T00-49-50-429Z` timed out at 240s during browser/context cleanup after width assertions, before summary.
- On integrated main `43c7352c`, real OSM/MapLibre with WebGL enabled: `CHANNEL=chrome LABEL=pr470-main450-osm DATA_MODE=mock USE_MOCK_TOOLS=true E2E_SCRIPT_TIMEOUT_MS=360000 pnpm --filter @trip/web e2e phone-map` — 348/348 passed, 62s (`2026-10-21T00-58-46-529Z`).
- On integrated main `43c7352c`, Google missing-key fallback: `CHANNEL=chrome LABEL=pr470-main450-google-fallback WEB_MAPS_PROVIDER=google DATA_MODE=mock USE_MOCK_TOOLS=true E2E_SCRIPT_TIMEOUT_MS=240000 pnpm --filter @trip/web e2e phone-map` — 348/348 passed, 32s (`2026-10-21T01-00-06-844Z`).
- Earlier retries on main `4f1d35e1`: OSM and Google fallback each passed 348/348 in 47s (`2026-10-21T00-55-31-531Z`, `2026-10-21T00-54-26-795Z`).
- `pnpm --filter @trip/web test` — 57 files, 642 tests passed; jsdom emitted expected canvas-not-implemented diagnostics.
- `pnpm --filter @trip/web typecheck`; `pnpm --filter @trip/web lint` — passed, no lint warnings/errors.
- `pnpm verify:docs`; `pnpm verify:protected`; `pnpm verify:pairs`; `pnpm format:check-changed origin/main` — passed; 27 documentation pairs checked.
- `pnpm verify:e2e-artifacts`; `pnpm verify:e2e-selectors` — passed; 87 scripts emit artifacts and selectors are defined.

## Notes for the next person

The initial integrated OSM retry timed out before runner summary; subsequent OSM retries completed successfully, including on current integrated main. Browser E2E uses mock planning/place data and does not establish physical-device or live Google Maps behavior. No Agent Note is needed.
