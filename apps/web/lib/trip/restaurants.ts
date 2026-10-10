import type { ProposalItem, TripPlan } from "@trip/shared";

const isPick = (item: ProposalItem) => item.kind === "meal" && !!item.id;

export function restaurantPicks(plan: TripPlan | undefined): ProposalItem[] {
  return (plan?.sections.find((section) => section.id === "dining")?.proposal?.items ?? []).filter(
    isPick,
  );
}

export function restaurantSuggestions(plan: TripPlan | undefined): ProposalItem[] {
  const scheduled = new Set(
    plan?.sections
      .find((section) => section.id === "itinerary")
      ?.proposal?.items.map((item) => item.id)
      .filter((id): id is string => !!id),
  );
  return restaurantPicks(plan).filter((item) => !scheduled.has(item.id!));
}

export function restaurantIds(plan: TripPlan | undefined): Set<string> {
  return new Set(restaurantPicks(plan).map((item) => item.id!));
}
