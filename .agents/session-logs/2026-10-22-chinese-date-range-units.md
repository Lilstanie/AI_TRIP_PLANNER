---
date: 2026-10-22
author: Codex
branch: fix/chinese-date-range-units
pr: none
area: apps/web, docs
contract-impact: none
---

# Keep Chinese month and day units in short trip dates

## What changed

- Shared date-range presentation formats Chinese endpoints explicitly; English keeps Intl range elision.
- Existing calendar browser journey checks literal month labels in active titles, desktop chips and saved chat titles.
- Updated both workspace UI guides; failure inventory preceded production edits.

## Why

- Chinese Intl formatRange returns ambiguous numeric slashes despite a short-month option.
- Formatter-derived expected titles repeated that behavior and could not expose the defect.

## Validation

- Before: 117/121 browser checks passed; four Chinese title assertions failed.
- Initial expanded journeys hit calendar-navigation timeouts: 26/27 and 79/80 passed. Both failures are retained separately from product assertions.
- `DATA_MODE=mock USE_MOCK_TOOLS=true CHANNEL=chrome RUN_ID=after-calendar-state pnpm --filter @trip/web e2e calendar-trip-date-label`: 181/181 passed, zero skips, exit 0.
- Desktop 1440×1000 and phones 390/375×844; EN/ZH; controlled 2030 clock; Honolulu/Sydney browser timezones; mock saved catalogs, no live providers.
- Visually inspected desktop Chinese chips and phone cross-year title; long phone titles retain existing ellipsis and full accessible names.
- `pnpm --filter @trip/web test`: 642 tests in 57 files passed; web typecheck and lint passed.
- Docs, protected files, 28 translation pairs, 100 E2E artifact producers and E2E selectors passed.

## Notes for the next person

- Runtime: Node v25.9.0, pnpm 9.15.0, Chrome 155.0.8059.85. Physical devices, real keyboard and live model/provider behavior are outside this fixture evidence.
- Retro: retain literal localized expectations; reuse the calendar journey rather than introducing another harness. Keyboard movement across December 31 changes the phone calendar month; desktop navigation remounts it.
