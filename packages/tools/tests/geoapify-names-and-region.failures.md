# Geoapify places keep their own name and stay in the visited region: failure inventory

Written before the code (TP-196). On 2026-10-30, live Geoapify results sometimes named 浅草寺
"Храм Сенсодзи 金龍山 浅草寺" (one of two versions of the same OSM way). Tokyo's top 10 sights also held
four Tokyo Disney rides in Urayasu, Chiba, inside the 15 km circle. Each line is a way the change
could fail.

- The stop shows the prefixed name because only `properties.name` is read.
- The local-language name is picked for a country without a mapping, or replaces a name that has
  no local tag, so the place loses its name.
- Both versions of one OSM object come back (one per sight request) and the day plan lists the
  place twice under two names.
- Places in a neighbouring prefecture or state stay in the list.
- A place without a region code, or a city whose region is unknown, is dropped.
- The region check removes everything, so a city near a border gets no sights.
- A failed neighbourhood lookup still leaves no trace in the server log, only an assumption in the
  plan (checked in `packages/agents/tests/itinerary/place-lookup-warning.test.ts`).
