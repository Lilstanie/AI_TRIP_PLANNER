import { z } from "zod";
import { ChatTurn, TripBrief } from "./contracts";
import { TripPlan } from "./plan";

/** The partial brief the intake agent carries between clarifying turns. */
export const TripIntakeDraft = z.object({
  tripId: z.string(),
  userId: z.string().default("demo-user"),
  destination: z.string().trim().min(1).optional(),
  dates: z.tuple([z.string(), z.string()]).optional(),
  groupSize: z.number().int().positive().optional(),
  budgetTotal: z.number().positive().optional(),
  nationality: z.string().trim().min(1).optional(),
});
export type TripIntakeDraft = z.infer<typeof TripIntakeDraft>;

export const TripIntakeRequest = z.object({
  tripId: z.string(),
  message: z.string().min(1),
  draft: TripIntakeDraft.optional(),
  history: z.array(ChatTurn).optional(),
});
export type TripIntakeRequest = z.infer<typeof TripIntakeRequest>;

export const TripIntakeResponse = z.object({
  reply: z.string(),
  draft: TripIntakeDraft,
  ready: z.boolean(),
  plan: TripPlan.nullable(),
});
export type TripIntakeResponse = z.infer<typeof TripIntakeResponse>;

export function completeTripBrief(draft: TripIntakeDraft): TripBrief | undefined {
  if (!draft.destination || !draft.dates || !draft.groupSize || !draft.budgetTotal) {
    return undefined;
  }
  return TripBrief.parse(draft);
}
