---
date: 2026-10-18
author: Codex
branch: fix/mobile-calendar-accessibility-388-394
pr: none
area: apps/web, docs
contract-impact: none
---

# Improve mobile Mine and calendar accessibility

## What changed

- Show the data-mode label in the phone Mine view in English and Chinese.
- Add localized calendar date names, `aria-current="date"` for today, and arrow-key roving focus across populated and empty dates.
- Widen the narrow timeline time column to 56 px and retain aligned stop dots.
- Update English and Chinese workspace documentation and E2E assertions.

## Why

One tab stop plus arrow-key navigation makes the full calendar grid keyboard reachable while preserving visible focus.

## Validation

- `DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS= pnpm --filter @trip/web e2e phone-mine` — passed at 390 px and 360 px; `output/e2e/runner/2026-10-17T13-15-47-844Z.json`.
- `DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS= pnpm --filter @trip/web e2e timeline` — passed; `output/e2e/runner/2026-10-17T13-24-24-480Z.json` and `output/playwright/timeline/after/`.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts` — passed.
- `pnpm exec prettier --check apps/web/app/styles/phone-mine.css apps/web/app/styles/timeline.css apps/web/app/styles/workspace-trips.css apps/web/components/workspace/TripsPage.tsx apps/web/tests/e2e/phone-mine.e2e.mjs apps/web/tests/e2e/timeline.e2e.mjs docs/workspace-ui.md docs/workspace-ui.zh.md` — passed.
- `git diff --check` — passed.
- An earlier timeline run reported four 404 console errors in the fare scenario; the subsequent full run passed that scenario and all other checks.

## Notes for the next person

No known gaps. No shared contract or Agent Note changed.
