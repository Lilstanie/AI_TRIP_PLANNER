import type { TripPlan } from "@trip/shared";
import type { EditInput } from "./trip-edit";

export type UndoStep = Extract<EditInput["operation"], { kind: "undo" }>;

export function undoStepOf(plan: TripPlan): UndoStep {
  const items = plan.sections.find((s) => s.id === "itinerary")?.proposal?.items ?? [];
  return {
    kind: "undo",
    activities: items
      .filter(
        (item) =>
          item.kind === "activity" && item.day !== undefined && item.startTime && item.endTime,
      )
      .map((item) => ({
        id: item.id!,
        day: item.day!,
        startTime: item.startTime!,
        endTime: item.endTime!,
        placeId: item.placeId,
        priceNeedsReview: item.priceNeedsReview,
        ...(item.savedPlace ? { savedPlace: item.savedPlace } : {}),
        ...(item.arriveBy ? { arriveBy: item.arriveBy } : {}),
      })),
  };
}
