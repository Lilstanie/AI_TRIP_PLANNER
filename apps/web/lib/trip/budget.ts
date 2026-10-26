import type { FlightSelection, ProposalItem, StaySelection, TripPlan } from "@trip/shared";
import { itineraryActivities } from "@/lib/workspace";
import { restaurantIds } from "./restaurants";

export const budgetCategories = [
  { id: "accommodation", label: "Accommodation" },
  { id: "transport", label: "Transport" },
  { id: "dining", label: "Meals" },
  { id: "itinerary", label: "Activities" },
] as const;

export type BudgetItem = {
  id: string;
  label: string;
  amount?: number;
  day?: number;
};

export type BudgetCategory = (typeof budgetCategories)[number] & {
  amount: number;
  items: BudgetItem[];
  unpriced: number;
  notCosted: boolean;
};

function selectedAmount(
  item: ProposalItem,
  stays: StaySelection[],
  flights: FlightSelection[],
): number | undefined {
  if (item.estCost !== undefined) return item.estCost;
  if (!item.selectionId) return undefined;
  const stay = stays.find((candidate) => candidate.id === item.selectionId);
  if (stay) {
    const selected = stay.candidates.find((candidate) => candidate.id === stay.selectedId);
    return selected ? selected.pricePerNight * stay.rooms * stay.nights : undefined;
  }
  const flight = flights.find((candidate) => candidate.id === item.selectionId);
  if (!flight) return undefined;
  return flight.candidates.find((candidate) => candidate.id === flight.selectedId)?.price;
}

export function deriveBudgetCategories(plan: TripPlan): BudgetCategory[] {
  const picks = restaurantIds(plan);
  return budgetCategories.map((category) => {
    const section = plan.sections.find((entry) => entry.id === category.id);
    const items = section?.proposal?.items ?? [];
    const stays = section?.proposal?.stays ?? [];
    const flights = section?.proposal?.flights ?? [];
    const visibleItems = items.filter((item) => !(item.id && picks.has(item.id)));
    const rows = visibleItems.map((item, index): BudgetItem => {
      const amount = selectedAmount(item, stays, flights);
      return {
        id: item.id ?? `${category.id}-${index}`,
        label: item.detail,
        ...(amount === undefined ? {} : { amount }),
        ...(item.day === undefined ? {} : { day: item.day }),
      };
    });
    const amount = section?.estCost ?? 0;
    const unpriced = visibleItems.filter((item) => selectedAmount(item, stays, flights) === undefined).length;
    return {
      ...category,
      amount,
      items: rows,
      unpriced,
      notCosted:
        (category.id === "transport" || unpriced > 0) &&
        amount === 0 &&
        !visibleItems.some((item) => selectedAmount(item, stays, flights) !== undefined),
    };
  });
}

export function countUnpricedActivities(plan: TripPlan): number {
  const picks = restaurantIds(plan);
  return itineraryActivities(plan).filter(
    (item) => item.estCost === undefined && !(item.id && picks.has(item.id)),
  ).length;
}
