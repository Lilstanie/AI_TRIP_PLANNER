# Phone Map: a stop that is not on the map (#541)

`phone-map-unplaced-stop.e2e.mjs` plans the first suggested trip with place search stubbed empty, so no
stop is on the map, and reads the Day stops sheet at 390 × 844 in English and Chinese. It must fail when:

- A row leads with the stop's description instead of its place name (the Trip tab's title).
- A row's accessible name is the description paragraph.
- A row shows an empty number circle, or no text says the stop is not on the map.
- No rows render, so nothing was checked.
