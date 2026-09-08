import {
  Coordinates as CoordinatesSchema,
  MapRoute as MapRouteSchema,
  TripMapData as TripMapDataSchema,
  tripItemId,
  type GeocodedPlace,
  type GeoJsonPosition,
  type MapPlace,
  type MapRoute,
  type MapsPort,
  type ProposalItem,
  type TripMapData,
  type TripSection,
  type UnresolvedMapLocation,
} from "@trip/shared";

const COMPOUND_LOCATION = /\s+(?:→|->)\s+/;

function categoryOf(kind: string): MapPlace["category"] {
  if (kind === "activity" || kind === "transport" || kind === "hotel" || kind === "meal") {
    return kind;
  }
  if (kind === "destination") return "destination";
  return "other";
}

async function resolvePlace(
  maps: MapsPort,
  query: string,
  near: string,
): Promise<{
  place: GeocodedPlace | null;
  reason?: string;
}> {
  if (!maps.geocode) return { place: null, reason: "Map geocoding is unavailable." };
  try {
    const place = await maps.geocode({ query, near });
    if (!place) return { place: null, reason: "No matching mock geographic fixture." };
    const coordinates = CoordinatesSchema.safeParse(place.coordinates);
    return coordinates.success
      ? { place: { ...place, coordinates: coordinates.data } }
      : { place: null, reason: "Map provider returned invalid coordinates." };
  } catch (error) {
    return {
      place: null,
      reason: error instanceof Error ? error.message : "Map geocoding failed.",
    };
  }
}

function routeCoordinates(
  geometry: GeoJsonPosition[] | undefined,
  from: MapPlace,
  to: MapPlace,
): GeoJsonPosition[] {
  return geometry && geometry.length >= 2
    ? geometry
    : [
        [from.coordinates.longitude, from.coordinates.latitude],
        [to.coordinates.longitude, to.coordinates.latitude],
      ];
}

async function resolveRoute(
  maps: MapsPort,
  from: MapPlace,
  to: MapPlace,
  id: string,
  day: number | undefined,
  item: ProposalItem | undefined,
  conflict: boolean,
): Promise<MapRoute[]> {
  try {
    const legs = await maps.route({
      from: from.name,
      to: to.name,
      fromCoordinates: from.coordinates,
      toCoordinates: to.coordinates,
    });
    return legs.flatMap((leg, index) => {
      const parsed = MapRouteSchema.safeParse({
        id: `${id}-leg-${index + 1}`,
        fromPlaceId: from.id,
        toPlaceId: to.id,
        coordinates: routeCoordinates(leg.geometry, from, to),
        durationMin: leg.durationMin,
        distanceKm: leg.distanceKm,
        mode: leg.mode,
        day,
        itemId: item ? id : undefined,
        conflict,
      });
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

/** Resolve text-only agent locations without making map availability block a plan. */
export async function enrichTripMap(
  sourceSections: TripSection[],
  maps: MapsPort,
  near: string,
): Promise<{ sections: TripSection[]; map: TripMapData }> {
  const places: MapPlace[] = [];
  const routes: MapRoute[] = [];
  const unresolved: UnresolvedMapLocation[] = [];
  const itemCoordinates = new Map<string, Pick<ProposalItem, "placeId" | "coordinates">>();

  for (const section of sourceSections) {
    const conflict =
      section.status === "needs_you" || Boolean(section.proposal?.conflictsWith.length);
    for (const [index, item] of (section.proposal?.items ?? []).entries()) {
      if (!item.location) continue;
      const id = tripItemId(section.id, index);
      const endpoints = item.kind === "transport" ? item.location.split(COMPOUND_LOCATION) : [];

      if (endpoints.length === 2) {
        const results = await Promise.all(
          endpoints.map((endpoint) => resolvePlace(maps, endpoint.trim(), near)),
        );
        const endpointPlaces = results.map((result, endpointIndex): MapPlace | undefined => {
          if (!result.place) {
            unresolved.push({
              itemId: id,
              location: endpoints[endpointIndex]!.trim(),
              reason: result.reason ?? "Location could not be resolved.",
            });
            return undefined;
          }
          const suffix = endpointIndex === 0 ? "from" : "to";
          const place: MapPlace = {
            id: `${id}-${suffix}`,
            providerPlaceId: result.place.id,
            name: result.place.name,
            category: "transport",
            coordinates: result.place.coordinates,
            day: item.day,
            itemId: id,
            sectionId: section.id,
            detail: item.detail,
            startTime: item.startTime,
            endTime: item.endTime,
            estCost: item.estCost,
            conflict,
          };
          places.push(place);
          return place;
        });
        const [from, to] = endpointPlaces;
        if (from && to) {
          itemCoordinates.set(id, { placeId: from.id, coordinates: from.coordinates });
          routes.push(...(await resolveRoute(maps, from, to, id, item.day, item, conflict)));
        }
        continue;
      }

      const result = await resolvePlace(maps, item.location, near);
      if (!result.place) {
        unresolved.push({
          itemId: id,
          location: item.location,
          reason: result.reason ?? "Location could not be resolved.",
        });
        continue;
      }
      const place: MapPlace = {
        id,
        providerPlaceId: result.place.id,
        name: result.place.name,
        category: categoryOf(item.kind),
        coordinates: result.place.coordinates,
        day: item.day,
        itemId: id,
        sectionId: section.id,
        detail: item.detail,
        startTime: item.startTime,
        endTime: item.endTime,
        estCost: item.estCost,
        conflict,
      };
      places.push(place);
      itemCoordinates.set(id, { placeId: place.id, coordinates: place.coordinates });
    }
  }

  const activitiesByDay = new Map<number, MapPlace[]>();
  for (const place of places) {
    if (place.category !== "activity" || place.day === undefined) continue;
    const dayPlaces = activitiesByDay.get(place.day) ?? [];
    dayPlaces.push(place);
    activitiesByDay.set(place.day, dayPlaces);
  }
  for (const [day, dayPlaces] of activitiesByDay) {
    dayPlaces.sort((left, right) => (left.startTime ?? "").localeCompare(right.startTime ?? ""));
    for (let index = 1; index < dayPlaces.length; index += 1) {
      const from = dayPlaces[index - 1]!;
      const to = dayPlaces[index]!;
      routes.push(
        ...(await resolveRoute(
          maps,
          from,
          to,
          `day-${day}-route-${index}`,
          day,
          undefined,
          from.conflict || to.conflict,
        )),
      );
    }
  }

  const sections = sourceSections.map((section) => ({
    ...section,
    proposal: section.proposal
      ? {
          ...section.proposal,
          items: section.proposal.items.map((item, index) => ({
            ...item,
            ...itemCoordinates.get(tripItemId(section.id, index)),
          })),
        }
      : undefined,
  }));

  return {
    sections,
    map: TripMapDataSchema.parse({ places, routes, unresolved }),
  };
}
