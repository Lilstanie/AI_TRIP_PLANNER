# Failure inventory: itinerary

Baseline: `origin/main` `25ce9fa` (2026-10-21), runner `output/e2e/runner/2026-10-21T13-40-34-278Z.json`.

- Desktop "remove drops the stop" fails while the phone pass is green. The check reads the stop count 500 ms after the menu click. Removal waits for `/api/trip/preview-edit`, so the count can still be the old value. In the baseline run the count was still 3 at the 500 ms sample. In a probe of the unchanged script, the desktop count had dropped by the first 500 ms sample; the timing varies between runs. Expected: the stop disappears once the server answers.
- Console 404s on desktop (two) and phone (one): `POST /api/places/details` for stop IDs the fixture does not stub. The real route answers 404 for these IDs. The timeline script already notes the same stand-in-ID issue (`docs/e2e-known-failures.md`).
- Repair: the remove check waits for the count to change (`waitUntil`) instead of sampling once; the places-details route is stubbed as the drawer walkthrough does, so the console check reflects product errors only.
- Would hide a regression: a remove that never happens still fails after the 8 s wait; a real 404 from another endpoint still fails the console check.
