import { z } from "zod";
import { AgentProposal, TripBrief } from "./contracts";

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

export const HitlDecision = z.object({
  checkpointId: z.string(),
  status: z.enum(["approved", "rejected"]),
  at: z.string().default(() => new Date().toISOString()),
});
export type HitlDecision = z.infer<typeof HitlDecision>;

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
});
export type TripPlan = z.infer<typeof TripPlan>;
