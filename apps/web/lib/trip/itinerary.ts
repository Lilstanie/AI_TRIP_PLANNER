import type { ProposalItem, TripPlan } from "@trip/shared";
import type { GooglePlace } from "../integrations/google";

export type ItineraryActivity = ProposalItem;

export type Stop = {
  activity: ItineraryActivity;
  day: number;
  number?: number;
  place?: GooglePlace;
};

export type Marker = {
  activityId: string;
  place: GooglePlace;

  verified: boolean;
  number: number;
  day: number;
  startTime?: string;
};

export type Itinerary = {
  days(): number[];

  stopsOn(day: number): Stop[];

  ideas(): ItineraryActivity[];

  stopCount: number;

  markersFor(day?: number): Marker[];

  stop(activityId: string): Stop | undefined;

  planIndex(activityId: string, day: number, position: number): number;
};

export function itineraryActivities(plan: TripPlan | undefined): ItineraryActivity[] {
  return (
    plan?.sections
      .find((section) => section.id === "itinerary")
      ?.proposal?.items.filter((item) => item.kind === "activity") ?? []
  );
}

export function visitingOrder<T extends { day?: number; startTime?: string }>(
  items: readonly T[],
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        (a.item.day ?? Number.MAX_SAFE_INTEGER) - (b.item.day ?? Number.MAX_SAFE_INTEGER) ||
        (a.item.startTime ?? "99:99").localeCompare(b.item.startTime ?? "99:99") ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}

export function buildItinerary(
  plan: TripPlan | undefined,
  placeFor: (activity: ItineraryActivity) => GooglePlace | undefined,
): Itinerary {
  const activities = itineraryActivities(plan);
  const scheduled = activities.filter((activity) => activity.day !== undefined);
  const ideas = activities.filter((activity) => activity.day === undefined);
  const numbers = new Map<string, number>();
  const stops = visitingOrder(scheduled).map((activity): Stop => {
    const found = placeFor(activity);
    const place = found?.location ? found : undefined;
    if (place && !numbers.has(place.id)) numbers.set(place.id, numbers.size + 1);
    return {
      activity,
      day: activity.day!,
      ...(place ? { place, number: numbers.get(place.id)! } : {}),
    };
  });
  const byDay = new Map<number, Stop[]>();
  for (const entry of stops) byDay.set(entry.day, [...(byDay.get(entry.day) ?? []), entry]);

  const markersFor = (day?: number) => {
    const seen = new Set<string>();
    return (day === undefined ? stops : (byDay.get(day) ?? [])).flatMap((entry): Marker[] => {
      if (!entry.place || !entry.activity.id || seen.has(entry.place.id)) return [];
      seen.add(entry.place.id);
      return [
        {
          activityId: entry.activity.id,
          place: entry.place,
          verified: !!entry.activity.placeId,
          number: entry.number!,
          day: entry.day,
          ...(entry.activity.startTime ? { startTime: entry.activity.startTime } : {}),
        },
      ];
    });
  };

  return {
    days: () => [...byDay.keys()].sort((a, b) => a - b),
    stopsOn: (day) => byDay.get(day) ?? [],
    ideas: () => ideas,
    stopCount: stops.length,
    markersFor,
    stop: (activityId) => stops.find((entry) => entry.activity.id === activityId),
    planIndex(activityId, day, position) {
      const all = byDay.get(day) ?? [];
      const shown = all.filter((entry) => entry.activity.id !== activityId);
      const inPlan = scheduled.filter(
        (activity) => activity.day === day && activity.id !== activityId,
      );
      const target = Math.min(Math.max(0, position), shown.length);
      const from = all.findIndex((entry) => entry.activity.id === activityId);

      if (target === shown.length) return inPlan.length;
      if (from >= 0 && target > from) return inPlan.indexOf(shown[target - 1]!.activity) + 1;
      return inPlan.indexOf(shown[target]!.activity);
    },
  };
}
