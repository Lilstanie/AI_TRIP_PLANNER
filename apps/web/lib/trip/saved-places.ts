import { CATALOG_KEY, parseCatalog, type WorkspaceCatalog } from "@/lib/workspace/catalog";

export type SavedPick = {
  key: string;
  placeId?: string;
  name: string;
  address?: string;
  location: { latitude: number; longitude: number };
};

export function savedPlacesOf(trips: WorkspaceCatalog["trips"], openTripId: string): SavedPick[] {
  const picks = new Map<string, SavedPick>();
  for (const trip of trips) {
    if (trip.id === openTripId || trip.snapshot.plan.tripId === openTripId) continue;
    const items =
      trip.snapshot.plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ??
      [];
    for (const item of items) {
      const place = item.savedPlace;
      if (!place) continue;
      const key =
        item.placeId ?? `${place.location.latitude},${place.location.longitude}|${place.name}`;
      if (!picks.has(key))
        picks.set(key, {
          key,
          ...(item.placeId ? { placeId: item.placeId } : {}),
          name: place.name,
          ...(place.address ? { address: place.address } : {}),
          location: place.location,
        });
    }
  }
  return [...picks.values()];
}

export function readSavedPlaces(openTripId: string): SavedPick[] {
  try {
    return savedPlacesOf(parseCatalog(window.localStorage.getItem(CATALOG_KEY)).trips, openTripId);
  } catch {
    return [];
  }
}
