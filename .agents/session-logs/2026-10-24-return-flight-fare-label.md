---
date: 2026-10-24
author: Claude (project thread for Joey)
branch: fix/return-flight-fare-label
pr: none
area: apps/web
contract-impact: none
---

# Return flight row says "Included in the outbound fare"

## What changed

- `apps/web/components/trip/timeline/BookingRow.tsx` and `apps/web/lib/i18n/workspace-messages.ts`:
  the message key "Included in the flight in" (shown as-is in English) is now "Included in the
  outbound fare". The Chinese value 含在去程票价中 is unchanged.
- New E2E `return-flight-fare-label` and its failure inventory; `docs/workspace-ui.md`.

## Why

#646: the English price line of a round-trip's return row ended mid-sentence.

## Validation

- `node scripts/redgreen.mjs return-flight-fare-label -- <BookingRow, workspace-messages>`: before exit 1
  (0/3 ok, the English row read "Included in the flight in"), after exit 0, 10/10 ok.
- `pnpm --filter @trip/web typecheck`, `lint`, `test`: pass.
