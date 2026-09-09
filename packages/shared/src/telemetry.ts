import { z } from "zod";
import { ChatResponse } from "./chat";

// High-level run telemetry for explaining orchestration without exposing model
// chain-of-thought or private prompts.
export const RunPhase = z.enum([
  "decomposing",
  "assigning",
  "running",
  "negotiating",
  "revising",
  "assembling",
  "complete",
]);
export type RunPhase = z.infer<typeof RunPhase>;

export const AgentRunStatus = z.enum(["queued", "running", "revising", "completed", "failed"]);
export type AgentRunStatus = z.infer<typeof AgentRunStatus>;

export const TokenUsage = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});
export type TokenUsage = z.infer<typeof TokenUsage>;

export const AgentRunTelemetry = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: AgentRunStatus,
  model: z.string().min(1),
  // Some structured-output adapters discard provider response metadata. Null
  // explicitly means unavailable; the UI must never invent an estimate.
  usage: TokenUsage.nullable(),
});
export type AgentRunTelemetry = z.infer<typeof AgentRunTelemetry>;

export const ChatRunProgress = z.object({
  phase: RunPhase,
  message: z.string().min(1),
  agent: AgentRunTelemetry.optional(),
});
export type ChatRunProgress = z.infer<typeof ChatRunProgress>;

export const ChatStreamEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("progress"), progress: ChatRunProgress }),
  z.object({ type: z.literal("result"), response: ChatResponse }),
  z.object({ type: z.literal("error"), error: z.string().min(1) }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEvent>;
