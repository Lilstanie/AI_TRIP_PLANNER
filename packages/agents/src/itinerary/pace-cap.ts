import type { TripPace } from "@trip/shared";
import type { ItineraryDraft } from "./index";
import { minutes } from "./landing";

export const PACE_MAX: Record<TripPace, number> = { relaxed: 2, balanced: 3, packed: 6 };

export function sightsByDay(draft: ItineraryDraft, restaurants: Set<string>) {
  const byDay = new Map<number, ItineraryDraft["activities"]>();
  for (const item of draft.activities)
    if (!restaurants.has(item.location.trim().toLowerCase()))
      byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
  return byDay;
}

export function trimToPace(
  draft: ItineraryDraft,
  restaurants: Set<string>,
  cap: number,
): ItineraryDraft {
  const dropped = new Set(
    [...sightsByDay(draft, restaurants).values()].flatMap((sights) =>
      [...sights].sort((a, b) => minutes(a.startTime) - minutes(b.startTime)).slice(cap),
    ),
  );
  if (!dropped.size) return draft;
  console.warn(`[itinerary] Dropped ${dropped.size} sights over the ${cap}-a-day pace cap`);
  return { ...draft, activities: draft.activities.filter((item) => !dropped.has(item)) };
}
