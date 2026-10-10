import { z } from "zod";
import { AgentProposal, TripBrief, RevisionRequest } from "./contracts";

export const SectionStatus = z.enum(["planning", "draft", "needs_you", "confirmed"]);
export type SectionStatus = z.infer<typeof SectionStatus>;

export const TripSection = z.object({
  id: z.string(),
  label: z.string(),
  summary: z.string(),
  status: SectionStatus,
  estCost: z.number().nonnegative(),
  proposal: AgentProposal.optional(),
});
export type TripSection = z.infer<typeof TripSection>;

export const TripPlan = z.object({
  tripId: z.string(),
  brief: TripBrief,
  editVersion: z.number().int().nonnegative().optional(),
  round: z.number().int().nonnegative(),
  budgetTotal: z.number().min(0.01),
  estTotal: z.number().nonnegative(),
  overrunPct: z.number(),
  sections: z.array(TripSection),
  conflicts: z.array(RevisionRequest).optional(),
  editIssues: z
    .array(
      z.object({
        code: z.enum(["route_unavailable", "price_unverified", "schedule_conflict"]),
        message: z.string(),
        activityIds: z.array(z.string()),
      }),
    )
    .optional(),
});
export type TripPlan = z.infer<typeof TripPlan>;
