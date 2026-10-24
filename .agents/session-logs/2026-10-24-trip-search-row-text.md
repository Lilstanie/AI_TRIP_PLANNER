---
date: 2026-10-24
author: Claude (Joey's project thread)
branch: fix/sidebar-trip-search
pr: pending
area: apps/web
contract-impact: none
---

# Trip search matches the text a trip row shows

## What changed

- `apps/web/lib/workspace/catalog.ts`: `searchCatalog` takes a `tripText` callback so a trip also
  matches the text its row shows; a numeric term matches only a whole number.
- `apps/web/lib/workspace/trip-identity.ts`: `tripMeta` and `tripDays` build the trip card's second
  line; `TripsPage` and the search in `useWorkspace` share it.
- `TripsPage` takes `allTrips` so phone cards keep "· 2" numbering when search filters the list
  (`PhoneMine` passes the full catalog).
- New `trip-search-row-text` E2E and failure inventory (written first). `docs/workspace-ui` en/zh.

## Why

Issue #641: "Trip to Sydney", "4 days" and "AUD" found no trip, because search read the stored title,
destination and ISO dates while the row showed a derived title and formatted meta text.

## Validation

- `node scripts/redgreen.mjs trip-search-row-text -- <five source files>`: before exit 1, 16/38 ok;
  after exit 0, 38/38 ok.
- `sidebar-search-counts` and `calendar-trip-identity-search` E2Es: pass.
