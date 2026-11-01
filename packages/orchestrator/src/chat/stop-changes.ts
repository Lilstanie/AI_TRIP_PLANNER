import type { TripPlan } from "@trip/shared";

const stops = (plan: TripPlan) =>
  plan.sections
    .flatMap((section) => (section.proposal?.agent === "itinerary" ? section.proposal.items : []))
    .filter((item) => item.day !== undefined && item.location)
    .map(
      (item) => `day ${item.day} ${item.startTime ?? ""}-${item.endTime ?? ""} ${item.location}`,
    );

export function stopChanges(before: TripPlan, after: TripPlan) {
  const old = stops(before);
  const next = stops(after);
  return {
    removed: old.filter((stop) => !next.includes(stop)),
    added: next.filter((stop) => !old.includes(stop)),
  };
}
