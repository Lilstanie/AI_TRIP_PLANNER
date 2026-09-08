import { z } from "zod";
import { Coordinates } from "./map";

// ---------------------------------------------------------------------------
// The five specialist agents. `name` is the stable id used as the section id
// in the trip plan; keep this list and @trip/agents `allAgents` in sync.
// ---------------------------------------------------------------------------
export const AGENT_NAMES = [
  "itinerary",
  "transport",
  "accommodation",
  "destination-guide",
  "dining",
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

// ---------------------------------------------------------------------------
// TripBrief — the structured request the Orchestrator hands to every agent.
// Every field here is reference data the agents plan against.
// ---------------------------------------------------------------------------
export const TripBrief = z.object({
  tripId: z.string(),
  userId: z.string().default("demo-user"),
  destination: z.string(),
  dates: z.tuple([z.string(), z.string()]), // [start, end] ISO date
  groupSize: z.number().int().positive(),
  budgetTotal: z.number().positive(),
  nationality: z.string().optional(),
});
export type TripBrief = z.infer<typeof TripBrief>;

// ---------------------------------------------------------------------------
// AgentProposal — what every specialist agent returns for one round.
// The `estCost` rule (currency = USD, whole trip not per-person) is frozen by A.
// ---------------------------------------------------------------------------
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const ProposalItem = z
  .object({
    kind: z.string(), // "transport" | "hotel" | "activity" | "meal" | "note" ...
    detail: z.string(),
    estCost: z.number().nonnegative().optional(),
    day: z.number().int().optional(),
    // Optional schedule metadata: lets the orchestrator detect cross-agent time
    // conflicts without parsing human-readable `detail` strings.
    startTime: z.string().regex(HHMM, "startTime must be HH:MM (24h)").optional(),
    endTime: z.string().regex(HHMM, "endTime must be HH:MM (24h)").optional(),
    location: z.string().trim().min(1).optional(),
    // Populated by the orchestrator's map-enrichment pass. Agents can continue
    // returning text-only locations, so this remains backwards compatible.
    placeId: z.string().optional(),
    coordinates: Coordinates.optional(),
  })
  // `.check()` (Zod 4's superRefine) keeps this a plain object, so B/C/D/E can
  // still `.extend()` / `.pick()` it. Three cross-field rules:
  .check((ctx) => {
    const { day, startTime, endTime } = ctx.value;
    if (Boolean(startTime) !== Boolean(endTime)) {
      ctx.issues.push({
        code: "custom",
        message: "startTime and endTime must be provided together",
        input: ctx.value,
        path: [startTime ? "endTime" : "startTime"],
      });
    } else if (startTime && endTime && startTime >= endTime) {
      ctx.issues.push({
        code: "custom",
        message: "endTime must be after startTime on the same day",
        input: ctx.value,
        path: ["endTime"],
      });
    }
    if (startTime && day === undefined) {
      ctx.issues.push({
        code: "custom",
        message: "day must be provided when startTime/endTime are set",
        input: ctx.value,
        path: ["day"],
      });
    }
  });
export type ProposalItem = z.infer<typeof ProposalItem>;

export const AgentProposal = z.object({
  agent: z.enum(AGENT_NAMES),
  summary: z.string(),
  items: z.array(ProposalItem),
  assumptions: z.array(z.string()),
  conflictsWith: z.array(z.string()).default([]),
});
export type AgentProposal = z.infer<typeof AgentProposal>;

// ---------------------------------------------------------------------------
// RevisionRequest — Orchestrator -> a single agent, rounds 2..K.
// ---------------------------------------------------------------------------
export const RevisionRequest = z.object({
  tripId: z.string(),
  targetAgent: z.enum(AGENT_NAMES),
  reason: z.string(), // "over budget by 18%", "day 2 route infeasible" ...
  constraints: z.array(z.string()),
});
export type RevisionRequest = z.infer<typeof RevisionRequest>;

// ---------------------------------------------------------------------------
// Memory records (owned by @trip/services/memory).
// ---------------------------------------------------------------------------
export const ChatTurn = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  at: z.string().default(() => new Date().toISOString()),
});
export type ChatTurn = z.infer<typeof ChatTurn>;

export const UserPreference = z.object({
  key: z.string(),
  value: z.string(),
  source: z.enum(["filter", "chat_confirmed"]),
});
export type UserPreference = z.infer<typeof UserPreference>;
