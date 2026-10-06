---
date: 2026-10-06
author: Claude Code
branch: feature/phone-shell
pr: 183
area: apps/web, docs
contract-impact: none
---

# Fix the phone shell code review findings

## What changed

- `lib/trip/item-actions.ts`: Move earlier / Move later is refused when the swapped pair would
  overlap the next stop (EN/ZH message; workspace-ui pair and item-actions note updated).
- `PhoneMapSheet.tsx`, `TripMapCanvas.tsx`: Ideas are no longer listed or mapped as Day 1 stops;
  sheet numbers match the map markers; a stop without a location keeps the sheet open.
  `WorkspaceView.tsx` follows a stop selected on the Trip tab to its day on the Map tab.
- `usePhoneKeyboard.ts`: pinch zoom no longer shrinks the shell. `usePhoneBack.ts`: a guard entry
  left by a reload is dropped; open menus are closed by Back; only the full map sheet is guarded.
- E2E: liquid-glass skips live map checks only without a browser key and checks console errors;
  phone-map records page errors and checks that an idea is not listed as a day stop (#186);
  phone-shell finds its companions from its own path.

## Validation

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `verify:docs`, `verify:protected`, `verify:pairs` pass.
- Production build on :3300: `phone-shell.e2e.mjs` 248/248; itinerary, timeline, settings and
  liquid-glass report no failures (map route and debug-map checks skip without a Maps key).

## Notes for the next person

- The overlap refusal has no E2E check: the mock plan has no day with three stops to reach it.
- The map fallback's place list now reopens and focuses a closed popup on desktop too (from
  92ae5bb); kept, because gating it to phones made `phone-map`'s desktop popup check fail.
- Not fixed (minor): a plan read on desktop still shows the Trip dot after resizing to a phone;
  the phone shell saves the desktop trip drawer as closed.
