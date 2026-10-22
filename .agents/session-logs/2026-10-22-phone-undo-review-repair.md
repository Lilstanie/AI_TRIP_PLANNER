---
date: 2026-10-22
author: Codex
branch: fix/phone-undo-hit-area
pr: 547
area: apps/web, docs
contract-impact: none
---

# Verify the phone Undo hit area and diagnose PR CI

## What changed

- Strengthened `apps/web/tests/e2e/phone-undo-hit-area.e2e.mjs` to capture visible bounds, both hit-area dimensions, page errors, and repeatable artifacts.
- Added `apps/web/tests/e2e/phone-undo-hit-area.failures.md` before changing the E2E check.
- Documented the 44 × 44 CSS-pixel phone target in `docs/workspace-ui.md` and `docs/workspace-ui.zh.md`.

## Why

The existing check only asserted height, and its screenshot could omit the off-screen Undo control. The E2E now scrolls the control into view and verifies width, height, visibility, and overflow.

## Validation

- `pnpm --filter @trip/web e2e phone-undo-hit-area` — passed at 375 × 812; Undo measured 61 × 44 CSS px, fully visible, document width 375, no page errors. Screenshot and JSON measurements saved under `output/playwright/phone-undo-hit-area/`.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm format:check-changed origin/main`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts`, `pnpm --filter @trip/web lint`, and `git diff --check` — passed.
- The first push hook rejected formatting in the new failure inventory; `npx prettier --write apps/web/tests/e2e/phone-undo-hit-area.failures.md` corrected it before retrying.
- GitHub CI job 119605405511 failed in `local-test-cli.e2e.mjs`: “Browser journey started before interruption” at line 413 with empty browser-journey output. This does not exercise the phone Undo UI, so no unrelated code change or blind rerun was made.

## Notes for the next person

The E2E verifies a 375 × 812 CSS-pixel browser viewport, not physical-device touch accuracy. No shared contract or Agent Note changed; the English and Chinese UI docs were updated together.
