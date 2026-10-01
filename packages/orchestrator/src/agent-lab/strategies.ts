import type { AgentLabStrategyId } from "@trip/shared";
import { multiAgentFixtureStrategy } from "./multi-agent-fixture";
import { singleAgentFixtureStrategy } from "./single-agent-fixture";
import type { AgentLabStrategy } from "./strategy";

const registry: Record<AgentLabStrategyId, AgentLabStrategy> = {
  "single-agent-baseline": singleAgentFixtureStrategy,
  "multi-agent-no-revision": multiAgentFixtureStrategy,
};

export const agentLabStrategySummaries = [
  { id: "single-agent-baseline", label: "Single-agent baseline" },
  { id: "multi-agent-no-revision", label: "Five specialists, no revision" },
] as const satisfies readonly { id: AgentLabStrategyId; label: string }[];

export function findAgentLabStrategy(id: AgentLabStrategyId): AgentLabStrategy {
  return registry[id];
}
