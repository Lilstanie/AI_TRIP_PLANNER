import type { TripPlan } from "@trip/shared";
import type { EditInput } from "./trip-edit";

/** The operation that puts a plan's scheduled stops back as they are now. */
export type UndoStep = Extract<EditInput["operation"], { kind: "undo" }>;

/**
 * The step that undoes a timeline edit: the day, times, place and leg of every scheduled stop in `plan`, the
 * plan the edit was checked against. Ideas have no day or times and are never part of the step, so an Idea
 * neither needs restoring nor blocks Undo. Shared by the browser and the server, so it imports no provider.
 */
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
        ...(item.arriveBy ? { arriveBy: item.arriveBy } : {}),
      })),
  };
}
