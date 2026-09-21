import { z } from "zod";
import { AgentProposal, TripBrief, RevisionRequest } from "./contracts";

// Status shown on each section of the right-hand "Your trip" panel.
// Maps 1:1 to where that agent's proposal sits in the Orchestrator loop.
export const SectionStatus = z.enum(["planning", "draft", "needs_you", "confirmed"]);
export type SectionStatus = z.infer<typeof SectionStatus>;

export const TripSection = z.object({
  id: z.string(), // = agent.name
  label: z.string(), // human label, e.g. "Getting around"
  summary: z.string(),
  status: SectionStatus,
  estCost: z.number().nonnegative(),
  proposal: AgentProposal.optional(), // full detail for the expanded view
});
export type TripSection = z.infer<typeof TripSection>;

// The aggregated artifact the UI renders. Produced by @trip/orchestrator.
//
// There is deliberately no pending-decision list here. The traveller changes a
// plan by saying so in chat or editing it; nothing in the product asks them to
// approve a checkpoint, and a stored plan that still carries the old `hitl`
// array parses because object schemas drop unknown keys.
export const TripPlan = z.object({
  tripId: z.string(),
  brief: TripBrief,
  editVersion: z.number().int().nonnegative().optional(),
  round: z.number().int().nonnegative(),
  budgetTotal: z.number().min(0.01),
  estTotal: z.number().nonnegative(),
  overrunPct: z.number(), // (estTotal - budgetTotal) / budgetTotal * 100, can be negative
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
