# Failure inventory: phone touch targets and map details

`phone-map.e2e.mjs` uses mock planning and places data. Its default renderer is real OpenStreetMap/MapLibre; the Google-only run verifies the missing-key fallback and has no map markers. The browser E2E does not establish physical-device behavior or live Google Maps behavior.

- Phone day chips or Trip disclosure headers render below 44 px, or their larger hit areas overlap adjacent controls or disrupt the sheet.
- Keyboard focus, `aria-pressed`, Enter/Space behavior, reduced-motion handling, or disclosure state changes when target sizes change.
- Added spacing causes page overflow, hides content behind the tab bar, or leaks into the 521 px and desktop layouts.
- Map markers, controls, or details become unreachable after crossing phone/desktop viewport widths, while the same control may work in a fresh page at that width.
- OSM marker content intercepts the visible phone details close button after the E2E's 521/1440 px viewport transitions; a visible and enabled button alone does not prove pointer reachability.
- The Google missing-key path is mistaken for OSM renderer coverage, or a passing retry overwrites the original failed-run report.

## Confirmed transitioned-viewport failure (2026-10-20)

Runner `output/e2e/runner/2026-10-20T12-27-54-458Z.json` failed at `phone-map.e2e.mjs:286` after 112 seconds. At 400×800, a real OSM marker label (`phone-map-place-1-0`) intercepted the ordinary pointer click on the visible, enabled “Close place details” control after the test crossed desktop widths. WebGL was enabled. A fresh 400×800 control run reached the close button and closed the sheet; an otherwise equivalent viewport-transition replay reproduced the interception. This isolates a post-transition stacking failure rather than a static 400 px collision or a hidden-control assertion.

The marker renderer's child stacking escaped the phone sheet's stacking order. Isolate the phone map renderer so its markers remain below sibling phone details. Keep the normal pointer click and the desktop boundary transitions in the regression run; do not force the click, disable WebGL, skip the failing width, or substitute the Google fallback for OSM evidence.

Expected result: the ordinary close-button click succeeds at all six tested phone widths after the desktop boundary transitions in both English and Chinese. OSM must report a ready renderer without fallback; the separate Google missing-key matrix must report its error-list fallback.

## Retest on integrated main (2026-10-21)

On integrated main `4f1d35e1`, the OSM run `2026-10-21T00-49-50-429Z` emitted the six-width assertions but exceeded its 240-second runner limit before cleanup wrote the summary. Preserve it as a timeout, not a pass. A fresh OSM retry completed at 348/348 in 47 seconds (`2026-10-21T00-55-31-531Z`), including the transitioned 400 px ordinary close click. The Google missing-key matrix completed at 348/348 in 47 seconds (`2026-10-21T00-54-26-795Z`). The timed-out run did not reproduce the marker interception; the exact 400 px transitioned replay on the pre-fix tree remains the failure evidence above.

## Retest on current integrated main (2026-10-21)

Current `origin/main` `43c7352c` is integrated. With WebGL enabled, the default real OSM/MapLibre matrix completed at 348/348 in 62 seconds (`2026-10-21T00-58-46-529Z`); the separate `WEB_MAPS_PROVIDER=google` missing-key fallback completed at 348/348 in 32 seconds (`2026-10-21T01-00-06-844Z`). Both retained their ordinary close-button clicks after phone/desktop viewport transitions. These current-main runs supersede the earlier 4f1d35e1 retries for final-tree evidence.
