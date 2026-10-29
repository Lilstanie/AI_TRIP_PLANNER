# Map renderer lifecycle: failure inventory

Written before production changes for #789 / TP-149. The approved seam is the running workspace in
Chrome, entered through saved Trip cards and Chat navigation. Google is a controlled SDK boundary;
OSM uses the real MapLibre renderer with an empty style. Every external HTTP request is intercepted.

- A Google SDK script failure falls back without ever mounting the failed renderer.
- A Google constructor leaves an error layer and throws after SDK loading succeeds; the workspace
  must still reach the OSM map and remove that layer.
- A Google authentication failure after markers and routes mount leaves its old canvas/error layer
  above the fallback, or invokes a stale subscriber after its map has unmounted.
- Two mounted maps replace one global authentication callback; destroying one loses the other's
  subscription or restores a callback belonging to a destroyed map.
- A strict Google-only policy silently falls back, keeps enabled controls for a failed renderer, or
  loses the selectable saved-place list. Retrying after recovery must remove the error notice.
- Repeated map subscriptions and one-shot idle callbacks survive renderer disposal, run against a
  removed map, or rely on the wrong renderer's subscription handle contract.
- Routes, marker cleanup, resize observers or animation frames access MapLibre after its style has
  been removed, crashing desktop Trip/Chat navigation or phone page/breakpoint transitions.
- Unmount while the Google SDK response is held creates an orphan map when that response arrives.
- A recovered map cannot zoom, focus a saved stop or show its details, or its satellite control stays
  enabled for OSM. Chat input and itinerary remain reachable after map failure.
- English/Chinese, 1440×1000/390×844 and 520/521 transitions produce errors or horizontal overflow.

Run with an isolated, credential-free fixture server as described in
[map renderer lifecycle](../../../../docs/map-renderer-lifecycle.md). Artifacts, including failed
runs, live under `output/playwright/map-renderer-lifecycle/<LABEL>/`.
