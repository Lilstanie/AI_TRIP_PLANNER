---
date: 2026-10-28
author: Claude
branch: feature/TP-142-home-map
pr: none
area: apps/web
contract-impact: none
---

# Trip home map and phone layout (#769, spec #765)

## What changed

- `TripHomeMap` (`components/workspace/TripHomeMap.tsx`) feeds the existing `TripMapCanvas` with the opened trip's plan through `useTripPlaces`, in the `aside` slot of `TripHome`; no controls added.
- `mapProviderOptions` in `lib/workspace/data-mode.ts` now holds the OSM/fallback flags that `useWorkspace` computed inline, so both maps read the same rule.
- The Trip home now opens on a phone: `open-home` no longer ignores phone, a resize keeps it, and the Mine card and calendar band open it. The empty top bar is gone on phone.
- CSS block in `workspace-trips.css`: two columns above 820 px, one column (header, tags, map) at 820 px and below.
- `docs/workspace-ui.md` and `.zh.md`, the Trip home Agent Note, E2E `trip-home-map` with `trip-home-map.failures.md` written first.
- Older raw scripts that opened a phone card and expected the conversation now call `openTripWorkspace`, which on a phone goes card, home, Back, chat row in Mine.

## Why

Spec #765 says the page works on a phone with the map stacked, so the phone had to get the home. Opening the trip's own plan, not the active one, keeps the active conversation untouched.

## Validation

See the pull request body for the commands and results.

## Notes for the next person

- A trip always carries a plan snapshot, so "no plan, no map" cannot be reached from storage; the map renders from `snapshot.plan`.
- Until #767 lists chats on the home, a phone reaches a conversation from the chat rows in Mine.
- The map keeps `touch-action: pan-y pinch-zoom` on phone so the page still scrolls; not tried on a real device.
