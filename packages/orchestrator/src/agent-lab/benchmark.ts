import { AGENT_LAB_ARTIFACT_SCHEMA_VERSION } from "@trip/shared";
import { agentLabFaultProfiles } from "./fault-profiles";
import { agentLabScenarios } from "./scenarios";
import { agentLabStrategySummaries } from "./strategies";

export const agentLabBenchmark = {
  id: "agent-lab",
  version: "1.0.1",
  artifactSchemaVersion: AGENT_LAB_ARTIFACT_SCHEMA_VERSION,
  fixture: {
    dataMode: "fixture",
    repeats: 1,
    scenarios: agentLabScenarios.map(
      ({ id, title, fixtureVersion, expectedOutcome, mustPassCheckIds }) => ({
        id,
        title,
        fixtureVersion,
        expectedOutcome,
        mustPassCheckIds,
      }),
    ),
    strategies: agentLabStrategySummaries,
    faults: agentLabFaultProfiles.map(({ id, scenarioId, strategyId, expected }) => ({
      id,
      scenarioId,
      strategyId,
      expected,
    })),
  },
  live: {
    dataMode: "live",
    scenarioIds: ["tokyo-couple", "paris-family-feasible", "tokyo-kyoto-multi-city"] as const,
    repeats: 3,
    strategies: agentLabStrategySummaries.filter(({ live }) => live),
    skippedStrategies: agentLabStrategySummaries.filter(({ live }) => !live).map(({ id }) => id),
    maxRuns: 27,
  },
} as const;
