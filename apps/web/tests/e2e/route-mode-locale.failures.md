# Route mode locale regression failure inventory

- **Stale marker title after locale switch:** the route layer closes over the locale when it creates AdvancedMarkerElements. Switching EN to ZH with the same stops and routes must replace the titles; switching back to EN must restore them.
- **Badge label regression:** each verified leg for WALK, TRANSIT, DRIVE and BICYCLE must expose its current translated title while retaining the expected marker.
- **Unverified route gets a badge:** an itinerary arc without a matching verified route must remain unbadged.
- **Focus-day redraw leaks markers:** changing focus day must remove the prior route layer's markers, leaving only the focused day's verified legs; clearing focus must restore all legs without duplicates.
- **Recreated layer resumes animation:** the locale redraw creates the layer with animation disabled; the animation effect must then reapply the current visible/reduced-motion state.
- **Viewport-dependent fixture failure:** desktop and phone runs must reach the real TripMap route layer and observe the same semantic marker behavior, without relying on fixed sleeps or live map services.
- **Fixture invalidates stable-input case:** LocaleProvider must update the language while mapped stops and routes remain referentially stable; otherwise an unrelated route input change could hide the missing dependency.
