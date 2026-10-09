import type { ProposalItem, TripPlan } from "@trip/shared";

/**
 * The restaurant picks the dining specialist found, kept in the dining section as `meal` items.
 *
 * A pick is a suggestion until the traveller schedules it: scheduling copies it into the itinerary
 * under the same id, and removing it deletes it from the dining section. So a pick is listed under
 * Ideas exactly while no itinerary item carries its id.
 */
const isPick = (item: ProposalItem) => item.kind === "meal" && !!item.id;

export function restaurantPicks(plan: TripPlan | undefined): ProposalItem[] {
  return (plan?.sections.find((section) => section.id === "dining")?.proposal?.items ?? []).filter(
    isPick,
  );
}

/** The picks not yet in the itinerary, in the order dining listed them. */
export function restaurantSuggestions(plan: TripPlan | undefined): ProposalItem[] {
  const scheduled = new Set(
    plan?.sections
      .find((section) => section.id === "itinerary")
      ?.proposal?.items.map((item) => item.id)
      .filter((id): id is string => !!id),
  );
  return restaurantPicks(plan).filter((item) => !scheduled.has(item.id!));
}

/** Ids of every dining pick, scheduled or not. */
export function restaurantIds(plan: TripPlan | undefined): Set<string> {
  return new Set(restaurantPicks(plan).map((item) => item.id!));
}
