import { z } from "zod";
import { AGENT_NAMES, isTripDate, TripBrief } from "./contracts";
import { Currency } from "./money";
import { TripPlan } from "./plan";

// The contract between the web client and POST /api/chat.
// Progress is streamed as NDJSON; the final frame contains one ChatResponse.
// Optional request modes preserve existing chat clients.

// What a blank conversation has stated so far, before it is complete enough to plan.
// The fields are restated rather than picked from TripBrief: TripBrief's whole-brief check (an end
// date after the start, a night per destination) cannot run on a brief that is still being built.
export const PartialTripBrief = z.object({
  destination: z.string().trim().min(1).optional(),
  origin: z.string().trim().min(1).optional(),
  dates: z
    .tuple([
      z.string().refine(isTripDate, "Enter a real date"),
      z.string().refine(isTripDate, "Enter a real date"),
    ])
    .optional(),
  groupSize: z.number().int().positive().optional(),
  budgetTotal: z.number().min(0.01).optional(), // always BASE_CURRENCY; see ./money
  // Travels with `budgetTotal` so a half-built brief can still explain the
  // conversion it came from. See TripBrief.budgetSource.
  budgetSource: z.object({ amount: z.number().positive(), currency: Currency }).optional(),
  nationality: z.string().optional(),
});
export type PartialTripBrief = z.infer<typeof PartialTripBrief>;

// Client -> server
export const ChatRequest = z.object({
  tripId: z.string(),
  message: z.string().min(1),
  // What earlier turns of a blank conversation already stated. The server merges
  // this turn's message onto it, so the traveller answers a follow-up question
  // instead of repeating everything.
  known: PartialTripBrief.optional(),
  // Optional for backward compatibility. The browser sends the latest brief so
  // serverless requests can apply incremental edits without sticky process state.
  brief: TripBrief.optional(),
  // The plan those edits apply to. The server is stateless, so a message that
  // only asks a question has no plan to return unless the client supplies the
  // current one — and every completed response must carry a plan.
  plan: TripPlan.optional(),
  // "start" begins a blank conversation: the brief is extracted only from the
  // message, and missing required fields are reported instead of defaulted.
  mode: z.enum(["chat", "plan", "start"]).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

// Server -> client
export const ChatResponse = z.object({
  reply: z.string(), // assistant text for the chat stream
  plan: TripPlan, // the fresh aggregated plan for the right-hand panel
});
export type ChatResponse = z.infer<typeof ChatResponse>;

// Sent instead of a plan when a blank conversation is still missing required
// fields: the assistant's question, plus everything understood so far.
export const ChatNeedsInfo = z.object({
  type: z.literal("needs_info"),
  question: z.string(),
  known: PartialTripBrief,
});
export type ChatNeedsInfo = z.infer<typeof ChatNeedsInfo>;

// Progress frames emitted while the orchestrator delegates work. The final
// ChatResponse remains unchanged; clients can render these frames as optional
// activity without coupling to LangGraph internals.
export const AgentProgressEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("coordinator"),
    phase: z.enum(["dispatch", "conflicts", "revision", "assembly"]),
    round: z.number().int().positive(),
    summary: z.string(),
    constraints: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("agent_started"),
    summary: z.string().optional(),
    constraints: z.array(z.string()).optional(),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("agent_completed"),
    summary: z.string().optional(),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("agent_failed"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    error: z.string(),
  }),
]);
export type AgentProgressEvent = z.infer<typeof AgentProgressEvent>;
