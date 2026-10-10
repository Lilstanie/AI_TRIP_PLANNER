import type { AgentLabMetrics } from "@trip/shared";
import type { UsageSnapshot } from "@trip/agents";

export function buildAgentLabUsage(snapshot: UsageSnapshot | undefined): AgentLabMetrics["usage"] {
  if (!snapshot || snapshot.calls === 0) {
    return {
      status: "unavailable",
      reason: "No model call was made, so no token usage was recorded.",
    };
  }
  if (snapshot.reported < snapshot.calls) {
    return {
      status: "unavailable",
      reason: `The provider reported usage for ${snapshot.reported} of ${snapshot.calls} model calls, so no total is reported.`,
    };
  }
  return {
    status: "measured",
    modelCalls: snapshot.calls,
    inputTokens: snapshot.inputTokens,
    outputTokens: snapshot.outputTokens,
    totalTokens: snapshot.totalTokens,
  };
}
