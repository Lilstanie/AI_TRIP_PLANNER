import type { GooglePlace } from "@/lib/integrations/google";
import { placeCategory } from "@/lib/map/place-category";

export const ADD_FILTERS = ["places", "stays", "restaurants", "experiences", "events"] as const;
export type AddFilter = (typeof ADD_FILTERS)[number];
export type SearchKind = Exclude<AddFilter, "places">;

export const KIND_QUERY_WORD: Record<SearchKind, string> = {
  stays: "hotel",
  restaurants: "restaurant",
  experiences: "things to do",
  events: "events",
};

const EVENT_TYPE = /event|theat|stadium|concert|festival|performing|arena|amusement|cinema/;

export function matchesFilter(place: GooglePlace, filter: AddFilter): boolean {
  if (filter === "places") return true;
  const type = place.primaryType ?? "";
  const isEvent = EVENT_TYPE.test(type);
  if (filter === "events") return isEvent;
  if (isEvent) return false;
  const category = placeCategory(place.primaryType);
  if (filter === "stays") return category === "stay";
  if (filter === "restaurants") return category === "food";
  return category !== "stay" && category !== "food";
}
