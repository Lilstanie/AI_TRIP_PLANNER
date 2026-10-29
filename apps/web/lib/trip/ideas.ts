import type { ProposalItem, TripPlan } from "@trip/shared";
import { buildItinerary } from "./itinerary";
import { restaurantSuggestions } from "./restaurants";

export function tripIdeas(plan: TripPlan): ProposalItem[] {
  return [...buildItinerary(plan, () => undefined).ideas(), ...restaurantSuggestions(plan)];
}
