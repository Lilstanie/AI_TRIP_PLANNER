import type { Metadata } from "next";
import {
  agentLabFaultProfileSummaries,
  agentLabScenarioSummaries,
  agentLabStrategySummaries,
} from "@trip/orchestrator";
import { AgentLabClient } from "@/components/agent-lab/AgentLabClient";
import { readLiveConfig } from "@/lib/agent-lab/live-gate";
import { liveDataBlock } from "@/lib/auth/live-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent Lab · AI Trip Planner",
  description:
    "Inspect and compare repeatable single-agent and multi-agent travel-planning experiments.",
};

export default async function AgentLabPage() {
  const enabled = readLiveConfig().enabled;
  const block = enabled ? await liveDataBlock() : undefined;
  return (
    <AgentLabClient
      scenarios={agentLabScenarioSummaries}
      strategies={agentLabStrategySummaries}
      liveEnabled={enabled && !block}
      liveUnavailable={block === "sign-in-required" ? "sign-in" : "off"}
      faultProfiles={agentLabFaultProfileSummaries}
    />
  );
}
