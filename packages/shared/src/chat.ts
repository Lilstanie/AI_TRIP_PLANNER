import { z } from "zod";
import { AGENT_NAMES, TripBrief } from "./contracts";
import { TripPlan } from "./plan";

// The contract between the web client and POST /api/chat.
// Owner: A. Frozen shape — streaming can be added later without changing it
// (the final frame of a stream is still one ChatResponse).

// A human's answer to one HitlCheckpoint (see plan.ts). The server is
// stateless per request (see `brief` below), so the client must resend every
// decision it wants honoured on each turn — the same pattern already used for
// `brief`. A decision whose `checkpointId` no longer matches a live checkpoint
// (e.g. the brief changed after approval) is simply ignored, not an error.
export const HitlDecision = z.object({
  checkpointId: z.string(),
  decision: z.enum(["approve", "reject"]),
});
export type HitlDecision = z.infer<typeof HitlDecision>;

// Client -> server
export const ChatRequest = z.object({
  tripId: z.string(),
  message: z.string().min(1),
  // Optional for backward compatibility. The browser sends the latest brief so
  // serverless requests can apply incremental edits without sticky process state.
  brief: TripBrief.optional(),
  // Same statelessness rule as `brief`: the client owns the running list of
  // decisions and resends all of them every turn.
  decisions: z.array(HitlDecision).default([]),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

// Server -> client
export const ChatResponse = z.object({
  reply: z.string(), // assistant text for the chat stream
  plan: TripPlan, // the fresh aggregated plan for the right-hand panel
});
export type ChatResponse = z.infer<typeof ChatResponse>;

// Progress frames emitted while the orchestrator delegates work. The final
// ChatResponse remains unchanged; clients can render these frames as optional
// activity without coupling to LangGraph internals.
export const AgentProgressEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("agent_started"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("agent_completed"),
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
