---
date: 2026-10-27
author: Codex
branch: feature/route-mode-icons
pr: 714
area: apps/web, docs
contract-impact: none
---

# Integrate route-mode badges with the Trip redesign

## What changed

- Integrated main `cbd5b7b4` (#726); preserved Trip terminology and route badge documentation in EN/ZH.
- Fixed stale badge titles: both route drawing and animation effects in `TripMap.tsx` depend on locale.
- Added a failure inventory and repeatable browser fixture using real TripMap, Settings and Locale providers.

## Validation

- Before the fix, stable stop/route props left English titles after switching to Chinese on desktop and phone.
- `CHANNEL=chrome node apps/web/tests/e2e/route-mode-locale.e2e.mjs`: passed at 1440x900 and 390x844; EN/ZH/EN, four modes, five legs with one unverified arc, day filtering, no browser errors or overflow.
- `pnpm --filter @trip/web build`, `typecheck`, `lint`, `test`: passed; existing regression suite 57 files / 642 tests. Existing hook and JSDOM canvas warnings remain.
- Independent Luna 6 high Spec review: zero findings; Standards review's locale finding is fixed and browser verified.
- Browser uses keyless MapLibre with mock data and an empty style; this does not prove live Google or provider service behavior.
- Node 26.8.1, pnpm 9.15.0; screenshots, red/green results and check logs retained outside clean:output paths.

## Notes for the next person

- Mode badges remain at endpoint midpoints; winding paths can place a badge beside the route. The four-mode contract does not distinguish bus/train/ferry.
- User authorized ordered merge after current-head checks, and separately authorized #508's two API-auth checklist additions.
- No API or shared contract changed. Updated `docs/workspace-ui.md` and its Chinese pair; no new Agent Note is needed.
