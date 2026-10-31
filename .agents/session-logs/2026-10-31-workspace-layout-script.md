---
date: 2026-10-31
author: Claude Code
branch: fix/workspace-layout-script
pr: none
area: apps/web
contract-impact: none
---

# A rejected Google key no longer leaves later maps blank

## What changed

- `trip-workspace-layout.e2e.mjs`: the one-avatar check runs at 900 px, title checks read
  `.chat-header__plain`, `.chat-header__title` and `.chat-header__trip-name`, and the rename step
  opens a Chat from Trip home.
- `docs/e2e-known-failures.md` and its pair drop the entry.
- `google-maps-sdk.ts` keeps the page's rejected key, and `map-renderer.ts` tells later renderers.
- `trip-home-action-panels` covers a map mounted after the rejection.

## Why

The product matches `docs/workspace-ui.md`: the avatars reduce at a top bar of 920 px or less, and
long titles truncate. The script still described the header from before #782.

Google calls `gm_authFailure` once per page. Later maps, including the Trip panel map, never heard
about the rejection and stayed blank.

## Validation

- `pnpm --filter @trip/web e2e trip-workspace-layout --prod`: passed.
- `pnpm --filter @trip/web e2e trip-home-action-panels --prod`: passed.
- Live dev run with the expired browser key: the Trip panel map stayed blank, and after the fix it
  showed OpenStreetMap. The early map centred on Tokyo and Kyoto while planning ran.

## Notes for the next person

Local `MAPS_API_KEY` returns 429 and the browser Maps key has expired, so plans have no stops and
real place photos in stop cards are still unverified. OpenStreetMap places carry no photos.
