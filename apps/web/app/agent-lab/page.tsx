import type { Metadata } from "next";
import { agentLabScenarioSummaries } from "@trip/orchestrator";
import { AgentLabClient } from "@/components/agent-lab/AgentLabClient";

export const metadata: Metadata = {
  title: "Agent Lab · AI Trip Planner",
  description: "Inspect a repeatable single-agent travel-planning experiment.",
};

export default function AgentLabPage() {
  return <AgentLabClient scenarios={agentLabScenarioSummaries} />;
}
