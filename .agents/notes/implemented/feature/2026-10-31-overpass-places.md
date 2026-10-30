# Agent Note: Geoapify, then Overpass, for the agents' free place search

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

With `MAPS_PROVIDER=osm` the agents asked Nominatim for `sight in Tokyo` and `neighborhood in
Tokyo`. Nominatim geocodes names, so both returned nothing and `restaurant in Tokyo` returned
restaurants named "Tokyo" in Vancouver and Modena. A real all-live trip on 2026-10-30 therefore got
no day-by-day stops on the free provider.

## Decision

`packages/tools/src/overpass.ts` answers a category query without a `textQuery` for `sight`,
`museum`, `neighborhood` and `restaurant`: it resolves the city with one Nominatim search, then asks
Overpass (`OVERPASS_BASE_URL`, default `https://overpass-api.de/api`) for named elements with that
category's OSM tags inside the city's area, or its bounding box when the city is not a relation.
Sights, museums and neighbourhoods also need a `wikidata` tag so only notable places come back;
restaurants do not. Up to 20 results, those with a Wikipedia link first. An Overpass failure is
thrown, so the itinerary records the provider as unavailable. Text queries and other categories keep
the Nominatim text search.

When `GEOAPIFY_API_KEY` is set, `packages/tools/src/geoapify.ts` answers `sight`, `museum` and
`restaurant` first: Nominatim finds the city centre (Geoapify's own city search put `京都`
in Shantou or Hainan in 2 of 6 live runs), then Places lists up to 500 named places of that category
within 15 km (`filter=circle`, `conditions=named`). It keeps 20, each name once: a Wikipedia link
first, then a Wikidata id, then the nearest; a feature whose name is not text is skipped. The city's
own boundary is not used: Tokyo's includes the Ogasawara islands, and a live run put every stop on
Iwo Jima, about 1,200 km away. Pure nearest-first ordering is not used either: a live run then
filled all 20 slots with statues within 1 km of Tokyo Station. A Geoapify error, a missing city or an empty list
logs a warning without the key and falls back to Overpass; when both fail the error names both.
Neighbourhoods always use Overpass, because Geoapify Places has no neighbourhood category.

## Alternatives considered

**Overpass only.** Joey first chose the keyless option on 2026-10-30. The live check that evening
failed for an hour: the public instance and its mirrors returned 502 or timed out, and one answered a
timeout as HTTP 200 with a `remark` runtime error (now treated as a failure). Joey then chose Geoapify
with Overpass as the fallback, because a demo cannot depend on a public instance with no SLA.

**Photon with `osm_tag`.** Photon still matches the query text against names, so a city name alone
does not list the places inside it.

## Consequences

- Overpass is slower than Nominatim (seconds per query) and the public instance has a daily budget,
  listed in [architecture](../../../../docs/architecture.md#free-services-limits-and-terms).
- Geoapify needs a free account and key per deployment (3,000 credits a day). A 500-place query
  costs more credits than a 20-place one, so a trip uses tens of credits per city.
- Results carry no rating; agents that rank by rating treat OSM places as unrated.
