import { z } from "zod";
import { AGENT_NAMES, FlightLeg, isTripDate, TripBrief } from "./contracts";
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
// fields: the assistant's own question, plus everything understood so far.
//
// There is no structured question here. The assistant asks in prose, in the
// chat, and the traveller answers by typing; a suggestion list or answer form
// would present a product capability that does not exist.
export const ChatNeedsInfo = z.object({
  type: z.literal("needs_info"),
  question: z.string(),
  known: PartialTripBrief,
});
export type ChatNeedsInfo = z.infer<typeof ChatNeedsInfo>;

// One line of a tool call's structured result, e.g. a stay candidate or a place.
// The label is the whole row, so a client never has to know the tool's domain.
export const ToolResultRow = z.object({
  label: z.string().min(1),
  detail: z.string().optional(),
});
export type ToolResultRow = z.infer<typeof ToolResultRow>;

// The model's own choice inside a tool result, e.g. the stay it picked out of
// the candidates. `rationale` is the model's stated reason, not a restatement.
export const ToolChoice = z.object({
  title: z.string().min(1),
  selected: ToolResultRow,
  rationale: z.string().optional(),
  alternatives: z.array(ToolResultRow).default([]),
});
export type ToolChoice = z.infer<typeof ToolChoice>;

// Sent instead of a plan when the traveller asked what a flight costs rather
// than for a trip to be planned: the fares themselves, with no itinerary,
// budget or decisions attached because none were asked for.
export const FlightAnswerOption = z.object({
  carrier: z.string(),
  /** Whole-party total in the base currency; see ./money. */
  price: z.number().nonnegative(),
  note: z.string().optional(),
  stops: z.number().int().nonnegative().optional(),
  durationMin: z.number().int().positive().optional(),
  /** The flights themselves, when the provider described them. */
  outbound: FlightLeg.optional(),
  /** The way home. Only fetched for the itineraries shown in full. */
  inbound: FlightLeg.optional(),
  roundTrip: z.boolean().optional(),
});
export type FlightAnswerOption = z.infer<typeof FlightAnswerOption>;

export const FlightAnswer = z.object({
  type: z.literal("flight_answer"),
  reply: z.string(),
  from: z.string(),
  to: z.string(),
  depart: z.string(),
  return: z.string().optional(),
  passengers: z.number().int().positive(),
  /** Cheapest first; empty when the provider had nothing or was unavailable. */
  options: z.array(FlightAnswerOption),
  /** Where the fares came from, so the UI can label them like any other result. */
  source: z.object({ kind: z.string(), label: z.string(), freshness: z.string() }).optional(),
});
export type FlightAnswer = z.infer<typeof FlightAnswer>;

// Progress frames emitted while the orchestrator delegates work. The final
// ChatResponse remains unchanged; clients can render these frames as optional
// activity without coupling to LangGraph internals.
export const AgentProgressEvent = z.discriminatedUnion("type", [
  z.object({
    // A streamed slice of the supervisor's or coordinator's own thinking. Text
    // is a delta, not the whole block; clients append by
    // (agent, round, episode, index).
    type: z.literal("agent_reasoning"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    // Which model call chain produced this block. One round can hold several —
    // the dispatch supervisor, then one revision supervisor per conflict pass —
    // and each numbers its own blocks from zero, so `round` alone does not
    // identify a block. Defaults to 0 for an emitter that never sets it.
    episode: z.number().int().nonnegative().default(0),
    index: z.number().int().nonnegative(),
    text: z.string().min(1),
  }),
  z.object({
    // The coordinator's account of a round boundary: what started it and what
    // it is waiting on. Renders as the round's heading in the transcript, and
    // is the only explanation a round number ever gets.
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
    // The bounded objective the supervisor handed this specialist, so a reader
    // can see what it was asked to do rather than only that it ran.
    objective: z.string().optional(),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("agent_completed"),
    summary: z.string().optional(),
    // What this round of work changed, in the specialist's own words. Present
    // on revisions, where the reason a round exists is the conflict it fixed.
    outcome: z.string().optional(),
    choice: ToolChoice.optional(),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("agent_failed"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    error: z.string(),
  }),
  z.object({
    type: z.literal("tool_started"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    callId: z.string().min(1),
    tool: z.string().min(1),
    label: z.string().min(1),
    summary: z.string().min(1),
    // The arguments the call was made with. Optional: older emitters omit it.
    args: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    type: z.literal("tool_completed"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    callId: z.string().min(1),
    tool: z.string().min(1),
    label: z.string().min(1),
    resultSummary: z.string().min(1),
    resultCount: z.number().int().nonnegative().optional(),
    // The result's own rows, bounded by the emitter (see BOUNDED_RESULT_ROWS).
    resultRows: z.array(ToolResultRow).optional(),
    // Set when the emitter had more rows than it published.
    resultTruncated: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("tool_failed"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    callId: z.string().min(1),
    tool: z.string().min(1),
    label: z.string().min(1),
    error: z.string().min(1),
  }),
]);

/** Emitters never publish more than this many rows for one tool result. */
export const BOUNDED_RESULT_ROWS = 20;
export type AgentProgressEvent = z.infer<typeof AgentProgressEvent>;
