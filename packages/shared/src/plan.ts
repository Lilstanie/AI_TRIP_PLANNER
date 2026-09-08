import { z } from "zod";
import { AgentProposal, TripBrief } from "./contracts";
import { TripMapData } from "./map";

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

// A point where the flow pauses for the human (HITL) or escalates.
export const HitlCheckpoint = z.object({
  id: z.string(),
  type: z.enum(["confirm_brief", "confirm_plan", "escalation"]),
  title: z.string(),
  detail: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
});
export type HitlCheckpoint = z.infer<typeof HitlCheckpoint>;

// The aggregated artifact the UI renders. Produced by @trip/orchestrator.
export const TripPlan = z.object({
  tripId: z.string(),
  brief: TripBrief,
  round: z.number().int(),
  budgetTotal: z.number(),
  estTotal: z.number(),
  overrunPct: z.number(), // (estTotal - budgetTotal) / budgetTotal * 100, can be negative
  sections: z.array(TripSection),
  hitl: z.array(HitlCheckpoint),
  // Optional so persisted plans and independently-tested agents remain valid.
  map: TripMapData.optional(),
});
export type TripPlan = z.infer<typeof TripPlan>;
