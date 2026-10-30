# Agent Note: Overpass for the agents' free place search

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

## Alternatives considered

**Geoapify Places.** A free key gives about 3,000 requests a day with ready-made categories, but needs
an account per deployment. Joey chose the keyless option on 2026-10-30.

**Photon with `osm_tag`.** Photon still matches the query text against names, so a city name alone
does not list the places inside it.

## Consequences

- Overpass is slower than Nominatim (seconds per query) and the public instance has a daily budget,
  listed in [architecture](../../../../docs/architecture.md#free-services-limits-and-terms).
- Results carry no rating; agents that rank by rating treat OSM places as unrated.
