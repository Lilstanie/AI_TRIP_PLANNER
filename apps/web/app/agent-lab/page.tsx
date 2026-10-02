import type { Metadata } from "next";
import { agentLabScenarioSummaries, agentLabStrategySummaries } from "@trip/orchestrator";
import { AgentLabClient } from "@/components/agent-lab/AgentLabClient";
import { readLiveConfig } from "@/lib/agent-lab/live-gate";

// Whether live runs are enabled is a deployment setting read per request, never baked in at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent Lab · AI Trip Planner",
  description:
    "Inspect and compare repeatable single-agent and multi-agent travel-planning experiments.",
};

export default function AgentLabPage() {
  return (
    <AgentLabClient
      scenarios={agentLabScenarioSummaries}
      strategies={agentLabStrategySummaries}
      liveEnabled={readLiveConfig().enabled}
    />
  );
}
