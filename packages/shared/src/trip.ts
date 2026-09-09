import { z } from "zod";
import { ChatTurn } from "./contracts";
import { TripPlan } from "./plan";

export const SavedTrip = z.object({
  tripId: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().trim().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  plan: TripPlan.nullable(),
});
export type SavedTrip = z.infer<typeof SavedTrip>;

export const TripSummary = SavedTrip.omit({ plan: true }).extend({
  destination: z.string().optional(),
  planVersion: z.string().nullable(),
});
export type TripSummary = z.infer<typeof TripSummary>;

export const TripSession = z.object({
  trip: SavedTrip,
  turns: z.array(ChatTurn),
});
export type TripSession = z.infer<typeof TripSession>;

export const TripListResponse = z.object({ trips: z.array(TripSummary) });
export type TripListResponse = z.infer<typeof TripListResponse>;
