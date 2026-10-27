# Phone Map without a trip: failure inventory (TP-117, #737)

`phone-map-empty-hint.e2e.mjs` opens the Map tab with no trip at 390x844 and 360x800, English and Chinese, and the desktop empty map area at 1440x900. Data mode is mock, so the basemap is the offline background style. It must fail when:

- The Map tab shows no basemap (`.trip-map-canvas .google-map` missing or not ready) and a grey placeholder card instead.
- More than one hint is visible in the map area, or the hint is not a glass surface (`glass-float`), or the old "Your map will appear here" card appears.
- Phone: the hint has no button that opens Chat, or the button does not switch to the Chat tab.
- The location permission card is visible before Locate me is tapped, or the browser geolocation API is called before the tap.
- The Locate me button does not ask for location when tapped.
- A travel profile home city is set and the basemap is still on the world view, or no home city is set and it is not on the world view (`data-basemap-centre`).
- Phone: a Day stops sheet is present with no trip.
- Phone, trip with an empty selected day: the sheet is not collapsed to its handle plus one line, or its body is expanded by default.
- Tiles or the style fail to load: an error alert, a Retry map button or a page error appears instead of the hint on a plain background.
- Desktop: the empty map area shows a second hint, no basemap, or a button that has nothing to open.
- Page errors in the browser console, or screenshots and `summary.json` are not written at both phone sizes.

Run `CHANNEL=chrome pnpm --filter @trip/web e2e phone-map-empty-hint` (add `--prod` when a dev overlay hides the UI). Output lands in `apps/web/output/playwright/phone-map-empty-hint/<LABEL>/`.
