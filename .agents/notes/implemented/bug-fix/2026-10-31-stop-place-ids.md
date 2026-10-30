# Agent Note: itinerary stops keep the OSM id the place tools found

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

A live trip on 2026-10-30 (`MAPS_PROVIDER=osm`, Geoapify places) planned six named stops and the map
showed none of them. Geoapify and Overpass return each place's OSM id and coordinates, but `Place`
had no id field, so the itinerary kept only the name. The map then searched by name and found none
of the three names it tried.

## Decision

- `Place` in `packages/shared/src/ports.ts` gains an optional `placeId`, in the form the map already
  resolves through `/api/places/details` (`osm:node|way|relation/<n>`). Adding an optional field
  leaves every existing producer and consumer valid.
- Overpass sets it from the element `type` and `id`; Geoapify from `datasource.raw.osm_type`
  (`n`, `w`, `r`) and `osm_id`. A place without an OSM id gets none.
- The itinerary copies the id onto an activity whose `location` matches a found place name, ignoring
  case and surrounding spaces. A stop the tools did not return gets no id.
- Stops do not get `savedPlace`: other trips list `savedPlace` items as places the traveller saved.

## Alternatives considered

**Copy coordinates into `savedPlace`.** The map would pin them without a lookup, but other trips
would list every agent stop as a place the traveller saved.

**Make the map's name search stricter.** The names were already exact; Nominatim's free-text search
just does not index many of them, so a better search could not fix the missing link.

## Consequences

- With an id the map uses the details lookup instead of the name search, so OSM stops get pins.
- Google Places results still carry no `placeId`; Google stops keep the name search.
