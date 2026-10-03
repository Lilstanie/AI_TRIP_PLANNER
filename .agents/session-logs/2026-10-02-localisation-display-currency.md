---
date: 2026-10-02
author: Codex
branch: feature/localisation-currency
pr: none
area: apps/web, docs
contract-impact: none
---

# Localisation and display currency

## What changed

- Started from the latest team `upstream/main` commit `81d0d22`, not the stale personal `main`.
- Added persisted English and Simplified Chinese language settings and kept the document language in sync.
- Added AUD, USD, CNY, and destination-local display currency options while preserving AUD as the planning and storage currency.
- Converted visible budgets and trip totals through one locale provider, including destination-aware currencies such as JPY for Tokyo.
- Localised the primary planning workspace, chat controls, trip facts, map prompts, and core navigation with English fallback for remaining secondary copy.
- Added responsive desktop and phone E2E coverage and updated the paired workspace UI documentation.

## Validation

- `corepack pnpm --filter @trip/web typecheck` — passed.
- `corepack pnpm --filter @trip/web lint` — passed; Next.js emitted its existing lint-command deprecation notice.
- `corepack pnpm --filter @trip/web test` — passed: 41 files, 405 tests; existing jsdom canvas warnings remain non-failing.
- `PLAYWRIGHT=... CHANNEL=chrome node apps/web/tests/e2e/localisation-currency.e2e.mjs` — passed at 1440×1000 and 390×844, including persistence, JPY destination currency, browser errors, and page overflow checks.
- `NEXT_DIST_DIR=.next-build corepack pnpm --filter @trip/web build` — passed with 21 static pages.
- `corepack pnpm verify:docs`, `corepack pnpm verify:pairs`, and `corepack pnpm verify:protected` — passed.

## Notes

- Exchange rates are fixed planning estimates dated 2026-09-20 and are labelled as approximate, not live quotes.
- The core workspace is bilingual; untranslated secondary and detailed copy intentionally falls back to English.
- The authenticated Clerk settings path was not automated; the local account settings path and persistence were covered end to end.
