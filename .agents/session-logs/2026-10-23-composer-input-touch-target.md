---
date: 2026-10-23
author: Claude Haiku 5.5 (scheduled triage run for Joey)
branch: fix/phone-composer-input-hit-area
pr: none
area: apps/web
contract-impact: none
---

# Make the phone message field a 44 px touch target

## What changed

- `apps/web/app/styles/composer.css`: inside the existing `@media (max-width: 520px)` block, `.composer__input` gets `min-height: 44px`. Desktop stays at 36 px.
- `apps/web/tests/e2e/composer-input-touch-target.e2e.mjs` and its failure inventory `composer-input-touch-target.failures.md`.

## Why

Issue #597. The phone field was 36 px high, so only a strip of the composer card worked as an input. `docs/design/ui-guidelines.md` requires a 44 × 44 px hit area on phone layouts.

## Validation

- Before the CSS change, `node tests/e2e/composer-input-touch-target.e2e.mjs` (run from `apps/web`, `LABEL=before`) failed: field 36 px, tap 40 px below the top did not focus it (`output/playwright/composer-input-touch-target/before/summary.json`).
- After the change, the same command passed with `LABEL=after` (field 44 px, tap focuses it, no overflow, no page errors; desktop 36 px).
- `node tests/e2e/phone-touch-targets.e2e.mjs`: exit 0.
- `pnpm exec vitest run tests/components/chat/Composer.test.tsx` in `apps/web`: 9 passed.
- `pnpm --filter @trip/web lint`: no ESLint warnings or errors. `pnpm verify:e2e-selectors` and `pnpm verify:e2e-artifacts`: pass.
- Prettier `--check` on the two changed source files: pass.

## Notes for the next person

The triage note cited `composer.css`, not a component. Tapping the card's empty padding still does not focus the field; this change only enlarges the field.
- The placeholder now sits at the top of the taller field, with the buttons on the row below (`output/playwright/composer-input-touch-target/after/390x844.png`). The hit area is correct, but the text is not vertically centred. Centring is not in this change.
- Review notes: the lower-card tap is not tested; the inventory row now names the 40 px tap the script makes.
