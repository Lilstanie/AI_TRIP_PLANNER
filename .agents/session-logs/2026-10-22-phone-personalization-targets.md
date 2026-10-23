---
date: 2026-10-22
author: Codex
branch: fix/phone-personalization-targets
pr: none
area: apps/web, docs
contract-impact: none
---

# Give phone Personalization edit rows a 44 px target

## What changed

- Added `button.memory-row__main` to the existing phone-only 44 px minimum control rule in `apps/web/app/styles/settings.css`.
- Extended `apps/web/tests/e2e/phone-sheet-targets.e2e.mjs` to measure every row's rendered bounds and live lower-edge hit target in English and Chinese.
- Added `apps/web/tests/e2e/phone-personalization-targets.failures.md` before implementation; updated `docs/workspace-ui.md` and `.zh.md` together.

## Why

The initial 390 × 844 browser run measured several single-line Personalization edit buttons at 34 px high. Wrapped rows were taller. The phone-only minimum preserves natural wrapping and desktop sizing.

## Validation

- Tested source commit `ca9f3375ccaf959194b27bb64c6b546f835ce90f`, tree `933d864f6f3123406f7cf6017f4a07fca7522211`, based on `804dd2aa2ccb1500a92d892c362e74955faafb64`.
- `pnpm --filter @trip/web e2e phone-sheet-targets`: 32/32 checks passed, fixture mode, Chromium, 390 × 844; all 16 localized edit rows measured 44 or 52 px, lower edge hit the matching button, no horizontal overflow or page errors. Screenshots: `output/playwright/phone-sheet-targets/after/`.
- Pre-fix `phone-sheet-targets` run failed on 34 px Personalization rows in both locales.
- `pnpm --filter @trip/web e2e settings`: unrelated theme-persistence assertion failed after reload on desktop and phone; remaining checks passed. This was not confirmed on baseline `origin/main`.
- `pnpm --filter @trip/web test`: 57 files, 642 tests passed; `pnpm --filter @trip/web lint` and `pnpm --filter @trip/web typecheck` passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts`, explicit Prettier check and `git diff --check` passed.
- Inspected desktop 1440 × 1000 and phone 390 × 844 Personalization screenshots; phone layout and desktop sizing remain intact.

## Notes for the next person

GitHub CI and `/retro` remain pending until the PR is open. No merge or branch deletion was performed. The settings theme reload failure is unclassified because it was not reproduced on unchanged main.
