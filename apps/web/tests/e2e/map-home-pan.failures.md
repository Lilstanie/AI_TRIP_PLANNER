# Home-base map centring: failure inventory (TP-118)

`map-home-pan.e2e.mjs` opens the blank desktop workspace with a travel profile home city and a controllable map. The home city lookup is held until the script releases it. It must fail when:

- The home base resolves after the traveller panned or zoomed the map, and the map snaps back to the home base.
- The home base resolves with no interaction and the map is not centred on it at the home zoom.
- Page errors appear in the browser console, or the screenshot and `summary.json` are not written.

Run `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=map-animation-fixture node apps/web/tests/e2e/legacy-runner.mjs map-home-pan` from the repository root (the synthetic key makes the page load the Google-compatible stub; add `--prod` when a dev overlay hides the UI). Output lands in `apps/web/output/playwright/map-home-pan/<LABEL>/`.
