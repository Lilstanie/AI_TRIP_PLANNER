# Geoapify temples, shrines and neighbourhoods: how it could fail

Written before the code for TP-197. The all-live Tokyo trip on 2026-10-31 had no temple and no
neighbourhood: the combined temple request took 15-22 s and hit the 15 s timeout, and every
neighbourhood request went to the overloaded public Overpass.

1. One slow category still times out the other: Buddhist and Shinto places must be separate requests
   with their own smaller limit, so a slow one loses only its own places.
2. A failed temple or shrine request is silent: a partial failure must log which categories failed
   near which city.
3. A partial answer is cached: sights without temples must not be served from the 10-minute cache;
   the next lookup asks again.
4. The sight list loses its temples to the 20-place cap: the temples must still rank with the other
   notable sights, not be dropped for being in a later request.
5. Neighbourhoods still need Overpass: Geoapify answers them from `populated_place.suburb`,
   `populated_place.quarter` and `populated_place.neighbourhood`, inside the same 15 km circle and
   region filter, with Overpass only as the fallback.
6. A neighbourhood lookup that Geoapify cannot answer returns nothing: it must still fall back to
   Overpass.
