---
date: 2026-11-01
author: Claude Code for Joey
branch: feature/TP-236-offer-cards
pr: none
area: apps/web, docs
contract-impact: none
---

# Show flight and stay options as a strip of cards (TP-236)

## What changed

- `apps/web/components/trip/timeline/FlightOffers.tsx`, `StayOffers.tsx`, `OfferStrip.tsx`: opening a flight or stay row shows a horizontal strip of option cards (tags, legs or stay dates, price, Choose button, comparison line) instead of the stay/flight card and the "Also found" list in `BookingRow.tsx`.
- `apps/web/lib/trip/flight-offers.ts`, `stay-offers.ts`: collapse options that look the same and keep at most six, chosen first.
- `FlightItineraryCard.tsx` exports its leg view for the trip cards; `components/ui/useScrollOverflow.ts` is shared with `PlanDays`.
- Removed the dead `.alternatives`, `.stay-facts`, `.result-card` styles and unused message keys; added the new en/zh keys.
- Offer cards use the glass radius (`--radius-xl`, the old `--radius-md` did not exist); day strip, stop cards, weather row, travel tips, editors and popovers in the trip panel move to `--radius-lg` with the glass highlight on weather and tips.
- `docs/workspace-ui.md` and `.zh.md` describe the offer cards.

## Why

Live searches returned 20 to 30 rows, many identical (same carrier and price), which Joey called ugly; the new layout follows the card-strip design he sent, in the app's own style.

## Validation

- `pnpm --filter web typecheck`: pass. `pnpm --filter web lint`: no errors.
- `npx vitest run tests/components` (apps/web): 20 files, 182 tests pass.
- `pnpm verify:docs`, `pnpm verify:pairs`, `check-ui-copy.mjs`: pass.
- Uncommitted Playwright script against `pnpm --filter @trip/web dev` (sample data, injected 27 fares and 19 stays): 6 flight and 6 stay cards at 1440 px (en, zh), 375 px (zh) and 390 px (en), no horizontal page scroll, no page errors; Choose on Rex re-priced the trip to AUD 980.

- Live run on Joey's Mac (real model, live SerpApi; Google Maps key expired so OSM): 6 cards per strip in en/zh at 1440 and 390 px, no page errors, Choose re-priced 2,192 → 2,258 → 2,192. It found unpicked round-trip fares labelled "One way" (only the picked fare gets its return leg) and leg-vs-trip time comparisons; fixed: round trip comes from the selection, comparisons use the outbound leg, arrows moved to the strip head, strip spans the panel width, cabin names translated.

## Notes for the next person

Sample fares carry no legs, so a plain mock trip shows the summary block instead of airport codes.
