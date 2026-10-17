import type { TripRecord } from "./catalog";

export function distinctTripTitles(
  trips: readonly TripRecord[],
  titleFor: (trip: TripRecord) => string,
) {
  const identity = (trip: TripRecord) => {
    const { brief } = trip.snapshot.plan;
    return JSON.stringify([brief.destination, brief.dates, brief.groupSize, brief.budgetTotal]);
  };
  const counts = new Map<string, number>();
  for (const trip of trips) counts.set(identity(trip), (counts.get(identity(trip)) ?? 0) + 1);
  const positions = new Map<string, number>();
  return new Map(
    trips.map((trip) => {
      const key = identity(trip);
      const position = (positions.get(key) ?? 0) + 1;
      positions.set(key, position);
      const title = titleFor(trip);
      return [trip.id, counts.get(key)! > 1 ? `${title} · ${position}` : title];
    }),
  );
}
