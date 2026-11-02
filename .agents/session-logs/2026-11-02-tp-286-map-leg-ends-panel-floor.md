---
date: 2026-11-02
author: Claude Code
branch: fix/TP-286-map-leg-ends-panel-floor
pr: none
area: apps/web
contract-impact: none
---

# Route legs reach their stops and the iOS map floor follows a tall details panel

## What changed

- `apps/web/components/map/map-layers.ts`: a leg with verified geometry now starts and ends at its
  stops, for every map provider.
- `apps/web/components/map/apple-maps-renderer.ts`: the map floor is limited by the visible canvas,
  not the middle of the native map box.
- `apps/web/tests/e2e/ios-app-shell.e2e.mjs`, `ios-app-shell.failures.md` and
  `apps/web/tests/components/map/map-layers.test.ts` lock both.

## Why

A temporary native log on production showed the Darling Harbour legs ending about 240 m and 480 m
from the pin, because routing snaps to a road. The layout log showed the details panel at y=412
while the floor stayed at 429, the box middle: the iOS bleed makes the box 864 pt tall, so real
stops with a panel over about 332 pt were centred 9 pt low.

## Validation

- `npx vitest run tests/components/map`: 28 passed; the new path assertion failed before the fix.
- `apps/web/tests/e2e/ios-app-shell.e2e.mjs` with system Chrome: the new check failed on old code
  (`floor` 406, `details` 341) and passed after (`floor` 341, `details` 341).
- `npx tsc --noEmit -p .` and `npx eslint` on the two source files: no errors.

## Notes for the next person

The sign-in status bar check in that E2E is intermittent on a dev server: it also read `24px` in a
baseline run without these changes. Production verification on the real Sydney trip waits for the
merge and deploy.
