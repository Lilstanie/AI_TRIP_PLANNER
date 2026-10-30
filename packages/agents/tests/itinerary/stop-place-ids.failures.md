# Stops keep the place the tools found: failure inventory

Written before the code (TP-183). A live OSM trip on 2026-10-30 planned six named stops, yet the map
showed no pins: the stop kept only the place name, and the map's name search found none of them.
Each line is a way the change could fail.

- Geoapify or Overpass drops the OSM id, so the stop has nothing the map can look up by id.
- The OSM id is written in a form `/api/places/details` rejects (it accepts `osm:node|way|relation/<n>`).
- Geoapify's one-letter `osm_type` (`n`, `w`, `r`) is passed through unchanged.
- A place with no OSM id gets an invented or empty `placeId`.
- The itinerary matches the stop to the wrong place: names differ only in case or spacing.
- A model draft that names a place the tools did not return gets a `placeId` from another place.
- The deterministic fallback and the model path behave differently.
- Stops gain `savedPlace`, so other trips list agent stops as places the traveller saved.
