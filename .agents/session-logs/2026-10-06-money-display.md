---
date: 2026-10-06
author: Claude Code, for HeadmasterEggy (C)
branch: refactor/money-display
pr: none
area: apps/web, docs
contract-impact: none
---

# One Money module for planning amounts, fares, differences and budget gaps (#199)

## What changed

- Added `apps/web/lib/money.ts`: `moneyDisplay({currency, locale, whole?})` returns `money(aud, source?)`,
  `fare({amount, currency})`, `delta(aud)` and `budgetGap(estimate, budget, source?)`; `fare()` and
  `currencyDigits()` are also exported for code outside React. Tests in `apps/web/tests/lib/money.test.ts`.
- `LocaleProvider` spreads the Money formatters into `useLocale()`. Trip panel, edit preview, review
  dialog, timeline fares, fact labels and trip list subtitles use them; the hand-built `+`/`−` and
  `Math.abs` wording are gone.
- Removed `formatAudForDisplay`, `formatProviderAmount`, `currencyDigits` and `CurrencyCode` from
  `apps/web/lib/i18n/locale.ts`, and the unused `{amount} left in budget` / `{amount} over budget` keys.
- Docs: `docs/workspace-ui.md` and its Chinese pair (pair re-recorded), `better-writing` skill.

## Why

Spec #196 Q13/Q14: two entry points (planning amount, provider fare) rather than a kind tag, plus a
signed difference and one budget sentence shared by every panel. The edit preview now uses the same
"under/over the {budget} budget" sentence as the trip panel. The review dialog's budget now shows a
stated source budget verbatim, as the trip panel already did. Fares group only from five digits so
`KRW 1400` stays as the timeline E2E expects.

## Validation

- `pnpm --filter @trip/web lint`, `typecheck`, `test`: pass (46 files, 485 tests).
- `pnpm verify:docs`, `pnpm verify:protected`, translate-docs `check-pairs.mjs`: pass.
- E2E against `next dev -p 3199`, no model or map keys: `display-currency` 50 ok, 0 fail;
  `timeline` 34 ok (route check skipped: no map key); `source-budget` 1440 px all 11 ok, then
  fails at 390 px waiting for "Open navigation", which the phone shell (#183) no longer renders there.

## Notes for the next person

- #203 builds on this: Agent Lab's own `money()`, the planner sentence (`money`/`budgetHint` in
  `lib/workspace/workspace.ts`, still used by the unused `tripFacts`) and the ESLint `.toFixed(2)` ban.
- Settings' travel budget preference (`AUD {v0} for a whole trip`) still uses `toLocaleString`; it is a
  stated AUD preference, not a workspace amount.
