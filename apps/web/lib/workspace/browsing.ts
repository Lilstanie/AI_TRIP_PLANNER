import type { TripPlan } from "@trip/shared";
import { itineraryActivities } from "@/lib/trip/itinerary";
import { dayCount } from "@/lib/trip/timeline";

export type TripBrowsing = {
  day: number;
  selectedOnToday: number | null;
  manual: boolean;
  selected?: string;
};

export function validSelectedStop(plan: TripPlan | undefined, selected: string | undefined) {
  return selected && itineraryActivities(plan).some((stop) => stop.id === selected)
    ? selected
    : undefined;
}

export function savedBrowsing(plan: TripPlan | undefined): TripBrowsing {
  const fallback: TripBrowsing = { day: 1, selectedOnToday: null, manual: false };
  if (!plan) return fallback;
  try {
    const value = JSON.parse(
      window.localStorage.getItem(`trip-day-selected:${plan.tripId}`) ?? "null",
    );
    if (!value || !Number.isInteger(value.day) || value.day < 1) return fallback;
    return {
      day: Math.min(value.day, dayCount(plan)),
      selectedOnToday: Number.isInteger(value.selectedOnToday) ? value.selectedOnToday : null,
      manual: value.manual !== false,
      selected: validSelectedStop(plan, value.selected),
    };
  } catch {
    return fallback;
  }
}

export function rememberBrowsing(tripId: string, patch: Partial<TripBrowsing>) {
  try {
    const key = `trip-day-selected:${tripId}`;
    const previous = JSON.parse(window.localStorage.getItem(key) ?? "null");
    window.localStorage.setItem(key, JSON.stringify({ ...previous, ...patch }));
  } catch {
    return;
  }
}
