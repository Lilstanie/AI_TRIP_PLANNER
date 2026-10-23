---
date: 2026-10-22
author: Codex
branch: fix/liquid-glass-calibration
pr: none
area: apps/web, docs, skills
contract-impact: none
---

# Calibrate glass materials and complete accessibility fallbacks

## What changed

- `tokens.css` and `glass.css`: restrained edge reflections, lower saturation, more opaque text surfaces and complete opaque fallbacks for floating controls.
- `glass-calibration.e2e.mjs`: desktop/phone, light/dark, Chinese, calendar, focus, overflow and display-preference evidence.
- `map-fallback.e2e.mjs`: verify map controls under reduced transparency, increased contrast and forced colors at both widths.
- Updated both UI guideline languages and the better-ui glass recipe with reference boundaries and calibration values.

## Why

Apple's macOS 27 kit and materials guidance inform the visual direction. Its public preview exposes no component properties; CSS values are Web adaptations. The implemented floating-layer decision remains unchanged.

## Validation

- Base: `ef900fe527e2ffe20696c90d141a2043319891d2`; isolated worktree preserves the original checkout's untracked session log.
- Node 26.8.1, pnpm 9.15.0, Chrome 155.0.8059.85, macOS; production Next server with mock data/tools, unavailable Google fixture and blank model/Maps/Clerk keys.
- `REDGREEN_RUN='python3 /tmp/glass-redgreen-run.py' node scripts/redgreen.mjs --base ef900fe5 glass-calibration map-fallback --prod -- apps/web/app/styles/glass.css apps/web/app/styles/tokens.css`: exit 0; before 96/126 (exit 1), after 126/126 (exit 0).
- The wrapper sets that environment and `LABEL=before/after`; the same two E2E scripts run against both CSS versions. Repeat the final journey with `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS=unavailable pnpm --filter @trip/web e2e glass-calibration map-fallback --prod`, with credentials blank.
- Final browser evidence: 90 glass checks and 36 map checks; zero skips, unexpected app errors or external map service requests. MapLibre uses a fixture empty style.
- Glass viewports: 1440×1000, 390×844 and 375×844, light/dark and EN/ZH. Map preferences: 390×844 and 1440×1000.
- Earlier attempts exposed phone locator/lazy-calendar timing, a dev-overlay interception and missing map fixture configuration; production selectors and waits corrected. A subsequent 89/90 run captured the existing favicon 404; its URL was reproduced independently and only `/favicon.ico` is excluded from console errors.
- `pnpm --filter @trip/web test`: 57 files, 642 tests passed; existing jsdom MapLibre warning.
- `pnpm --filter @trip/web lint` and `pnpm --filter @trip/web typecheck`: passed. Both production E2E builds passed.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors` and `pnpm verify:e2e-artifacts`: passed.
- Added-comment check against `origin/main` for both changed E2E scripts: no violations.
- Artifacts: `output/playwright/glass-calibration/{before,after}/` and `output/playwright/map-fallback/{before,after}/`; final runner report `output/e2e/runner/2026-10-22T11-51-10-221Z.json`.

## Notes for the next person

Attach screenshots and quote results in the PR before `pnpm clean:output`. These are viewport/fixture checks, not live Google/OSM or physical-device evidence. Unsupported-backdrop fallback was inspected in CSS but not exercised in a separate unsupported browser. No contract or implemented decision changed; shared design docs and the implementation recipe are updated.
