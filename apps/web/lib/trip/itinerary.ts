import type { ProposalItem, TripPlan } from "@trip/shared";
import type { GooglePlace } from "../integrations/google";

/** An itinerary activity: a stop when it has a day, an idea when it has none. */
export type ItineraryActivity = ProposalItem;

/** One visit to a place on a day. `number` is the place's stop number; unlocated stops have none. */
export type Stop = {
  activity: ItineraryActivity;
  day: number;
  number?: number;
  place?: GooglePlace;
};

/** One numbered marker on the map: a located stop at its place. */
export type Marker = {
  activityId: string;
  place: GooglePlace;
  /** The plan names this place by its Google place ID, rather than by a name lookup. */
  verified: boolean;
  number: number;
  day: number;
  startTime?: string;
};

/**
 * The one reading of a plan's stops and ideas that every view shares: the maps, the trip list, the
 * timeline and the Trip button.
 *
 * - A stop is an itinerary activity with a day; an idea has none and is never counted, numbered
 *   or mapped.
 * - Stops are in visiting order everywhere: day, then start time, then position in the plan.
 * - Stop numbers are trip-wide, one per located place in visiting order; a place visited again
 *   keeps its first number. A stop without a located place has no number.
 */
export type Itinerary = {
  /** Days that have at least one stop, ascending. */
  days(): number[];
  /** A day's stops in visiting order. */
  stopsOn(day: number): Stop[];
  /** Activities without a day, in plan order. */
  ideas(): ItineraryActivity[];
  /** Stops in the trip; ideas excluded. */
  stopCount: number;
  /**
   * Markers in visiting order. Without `day`, one per place at its first visit (the whole-trip
   * map); with `day`, one per place at its first visit that day.
   */
  markersFor(day?: number): Marker[];
  /** A stop by activity id; ideas and unknown ids give undefined. */
  stop(activityId: string): Stop | undefined;
  /**
   * The index the edit preview endpoint needs to move `activityId` onto `day` at `position`, where
   * `position` counts that day's stops as shown (visiting order) without the moved stop, clamped to
   * the day. The endpoint indexes the day's other stops in plan order, so the two can differ: a stop
   * moved later on its own day lands just after the stop shown above `position`, any other move just
   * before the stop shown at it, so it passes the neighbour the traveller moved it past; the end of
   * the day is after every other stop in the plan.
   */
  planIndex(activityId: string, day: number, position: number): number;
};

/** Itinerary activities in plan order; hotels and transport are never mapped. */
export function itineraryActivities(plan: TripPlan | undefined): ItineraryActivity[] {
  return (
    plan?.sections
      .find((section) => section.id === "itinerary")
      ?.proposal?.items.filter((item) => item.kind === "activity") ?? []
  );
}

/** Visiting order: day, then start time, then plan position. Items without a day come last. */
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

/**
 * Build the Itinerary from a plan and the places already looked up. `placeFor` returns an
 * activity's place, if one is known; only places with a location count as located. No lookups
 * happen here.
 */
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
      // The endpoint inserts in plan order and re-times the day from there, so a stop lands next to
      // the neighbour it moved past: later goes just after the stop shown above the target, earlier
      // (or onto another day) just before the stop shown at it.
      // The end of the day is the end of the plan's day, after every other stop.
      if (target === shown.length) return inPlan.length;
      if (from >= 0 && target > from) return inPlan.indexOf(shown[target - 1]!.activity) + 1;
      return inPlan.indexOf(shown[target]!.activity);
    },
  };
}
