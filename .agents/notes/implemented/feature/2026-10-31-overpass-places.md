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
within 15 km (`filter=circle`, `conditions=named`). Sights take three requests: up to 500
`tourism.sights,tourism.attraction`, then up to 200 Buddhist and up to 200 Shinto places of worship,
because Geoapify files Meiji Jingu under `religion.*` only, and 浅草寺 was missing from 500
`tourism.*` results. It keeps 20, each name once, ranked by an OSM
`tourism` tag or a Wikipedia link (2 each), a Wikidata id and an image (1 each), then the nearest;
the official `contact:website` wins over `website`; a feature whose name is not text is skipped. The city's
own boundary is not used: Tokyo's includes the Ogasawara islands, and a live run put every stop on
Iwo Jima, about 1,200 km away. Pure nearest-first ordering is not used either: a live run then
filled all 20 slots with statues within 1 km of Tokyo Station. A Geoapify error, a missing city or an empty list
logs a warning without the key and falls back to Overpass; when both fail the error names both.
The sight requests are settled separately: a live trip lost all its stops twice when the temple
request passed the 15 s timeout and took the sights with it, so one answered request is enough and
only failures of all of them count as a Geoapify failure. Buddhist and Shinto places are separate
requests (TP-197): one combined request of 500 took 15–22 s and timed out on the 2026-10-31 live
trip, which then had no temple, while each alone of 200 took 4–6 s. A failed request among the
others logs which categories failed near which city. A city and category's places are kept for 10 minutes
and shared by concurrent callers, since one trip's agents asked for the same sights several times at
8–13 s each; failed, partial or empty lookups are not kept.
A place is named by its local-language tag (`name:ja` in Japan, `name:zh` in China and so on)
when it has one, because one of two live versions of 浅草寺's OSM way was named
"Храм Сенсодзи 金龍山 浅草寺"; an OSM object returned by both sight requests is listed once. The
city's ISO 3166-2 region comes from the Nominatim centre (`addressdetails=1`). A place whose own
`iso3166_2` differs is dropped, because Tokyo's circle reached four Tokyo Disney rides in Urayasu,
Chiba. A place without a region code is kept, and so is every place when the city's region is unknown.
Neighbourhoods come from Geoapify too (TP-197), as `populated_place.suburb`,
`populated_place.quarter` and `populated_place.neighbourhood` within the same circle and region:
the first version kept them on Overpass in the belief that Geoapify had no neighbourhood category,
and on the 2026-10-31 live trip all three Overpass requests timed out or returned 502. Geoapify
answered Tokyo's in 4.8 s (Akihabara, Yanaka, Gotanda). Overpass stays their fallback.

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
