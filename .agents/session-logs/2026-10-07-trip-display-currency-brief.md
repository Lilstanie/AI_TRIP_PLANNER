---
date: 2026-10-07
author: Claude Code (for Joey)
branch: feature/227-trip-display-currency
pr: none
area: packages/shared, packages/orchestrator, apps/web, docs
contract-impact: packages/shared
---

# A trip is displayed in the last currency the traveller named for it (#227)

## What changed

- `packages/shared`: optional `displayCurrency` on `TripBrief` and `PartialTripBrief`; `effectiveCurrency()` in `money.ts`.
- `packages/orchestrator`: `BriefPatchSchema.displayCurrency`; the offline extractor sets it from `detectCurrency`
  with or without a budget; `update_trip_brief` takes `displayCurrency` without an amount (prompt updated).
- `apps/web`: `Draft.displayCurrency` through `draftFor`, `parseDraft`, `knownFromDraft`, `draftWithKnown`;
  `LocaleProvider` and the trip list use `effectiveCurrency`; trip cards end with the trip's own total.
- `apps/web/lib/planning/quick-prompts.ts`: example budgets no longer say "AUD" (see Why), with the two tests that matched it.
- New `apps/web/tests/e2e/trip-display-currency.e2e.mjs`, failure inventory first.
- Docs: `architecture`, `api`, `workspace-ui` in English and Chinese; Agent Note
  `2026-10-07-trip-display-currency.md`; code-review skill links it.

## Why

Joey approved the shared-contract change on 2026-10-07 ("都可以改"). Naming AUD must set AUD, so the example
prompts' "4000 AUD" would pin every example trip to AUD and stop it following Settings; `display-currency.e2e.mjs`
(which must still pass) caught that. A bare amount is still an AUD planning amount.

## Validation

- `pnpm --filter @trip/web e2e trip-display-currency`: red first (display currency ignored), then 66/66 checks
  green at 1440 and 390 px; screenshots and `summary.json` in `output/playwright/trip-display-currency`.
- `e2e display-currency source-budget ui-language`: passed (display-currency failed until the example prompts changed).
- `pnpm --filter @trip/{shared,orchestrator,web} test`: 52, 227 and 596 tests passed. Typecheck and lint of the three: passed.
- `pnpm verify:docs`, `verify:pairs`, `verify:protected`: passed.

## Notes for the next person

- Server-written text (summaries, conflicts, progress, replies) still says AUD: ticket #228.
- The trip list's sidebar subtitle with a total was computed but never rendered; the visible trip list is the Your trips cards.
- "Budget still reads 3000 CNY" is checked in the stored brief (`budgetSource`); no screen shows the original amount once the trip is read in another currency.
