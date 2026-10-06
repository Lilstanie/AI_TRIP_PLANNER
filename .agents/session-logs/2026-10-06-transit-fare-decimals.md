---
date: 2026-10-06
author: Claude Code
branch: fix/190-transit-fare-decimals
pr: none
area: apps/web, docs
contract-impact: none
---

# Provider transit fares follow their currency's decimal places (#190)

## What changed

- `apps/web/lib/i18n/locale.ts`: `currencyDigits()` (JPY 0, others 2) is now the default digit rule
  of `formatAudForDisplay`, and `formatProviderAmount()` formats a provider-native amount in its own
  currency with those digits (`JPY 230`, `AUD 12.50`), never converted.
- `apps/web/lib/trip/timeline.ts` and `components/trip/timeline/EditPreviewPanel.tsx` use it instead
  of `toFixed(2)`.
- `apps/web/tests/e2e/timeline.e2e.mjs`: a fare check that stubs the preview-edit response with a
  JPY and an AUD transit leg and reads both the edit preview and the timeline; the dev-mode indicator
  is hidden so the phone tab clicks land.
- `docs/workspace-ui.md` / `.zh.md` and the better-writing skill name the fare formatter.

## Validation

- `BASE_URL=http://localhost:3104 node apps/web/tests/e2e/timeline.e2e.mjs` (mock mode): failed
  before the fix on `JPY 230.00` (preview and timeline), then 32 ok, 0 failed; route check skipped
  as before (no map key).
- `display-currency.e2e.mjs`: 50 ok, exit 0.
- `pnpm --filter @trip/web typecheck` and `lint`: clean.

## Notes for the next person

- The "1440px light: planning with mock data" check in `openTimeline` failed once in an early run and
  passed on every later run; it looks like a hydration race in the data-mode toggle loop.
