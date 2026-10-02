import type {
  AgentLabCompletedRunArtifact,
  AgentLabMetrics,
  AgentLabRunEvent,
  ProposalItem,
  TripPlan,
} from "@trip/shared";
import { cityNames, normal } from "./cities";
import { evaluateAgentLabPlan } from "./evaluate";
import { findAgentLabScenario, type AgentLabScenario } from "./scenarios";

/** Everything measured from the final plan and the trace; wall time is measured while running. */
export type AgentLabMeasurement = Omit<AgentLabMetrics, "durationMs" | "latencyMs">;

const GROUNDED_SOURCES = new Set(["live", "estimated", "mock"]);

function activities(plan: TripPlan): ProposalItem[] {
  return plan.sections
    .filter((section) => section.id === "itinerary")
    .flatMap((section) => section.proposal?.items ?? [])
    .filter((item) => item.kind === "activity");
}

function isGeneric(location: string | undefined, cities: string[]): boolean {
  if (!location || !normal(location)) return true;
  const place = normal(location);
  return (
    cities.includes(place) ||
    /\bnear\b/.test(place) ||
    /^(mock |generic )?(attraction|restaurant|place|sight|museum|cafe|landmark|venue)\b/.test(place)
  );
}

function multiCityConsistent(scenario: AgentLabScenario, plan: TripPlan): boolean | null {
  const cities = cityNames(scenario.brief.destination);
  if (cities.length < 2) return null;
  const mentions = (items: ProposalItem[], city: string) =>
    items.some((item) => normal(`${item.location ?? ""} ${item.detail}`).includes(city));
  const stays = plan.sections
    .filter((section) => section.id === "accommodation")
    .flatMap((section) => section.proposal?.items ?? [])
    .filter((item) => item.kind === "hotel");
  const stops = activities(plan);
  return cities.every((city) => mentions(stays, city) && mentions(stops, city));
}

/**
 * Every deterministic figure about a run, computed from the final plan and the trace alone. There is no
 * judge, clock or hidden input, so anyone can recompute it from the artifact and compare.
 */
export function measureAgentLabRun(
  scenario: AgentLabScenario,
  plan: TripPlan,
  events: readonly AgentLabRunEvent[],
): AgentLabMeasurement {
  const count = (...types: string[]) =>
    events.filter((runEvent) => types.includes(runEvent.event.type)).length;
  const cities = cityNames(scenario.brief.destination);
  const stops = activities(plan);

  const seen = new Set<string>();
  let duplicateStops = 0;
  for (const stop of stops) {
    if (!stop.location || !normal(stop.location)) continue;
    const place = normal(stop.location);
    if (seen.has(place)) duplicateStops += 1;
    seen.add(place);
  }

  const stopped = [...events]
    .reverse()
    .find((runEvent) => runEvent.event.type === "lab_loop_stopped");

  return {
    ...evaluateAgentLabPlan(scenario, plan),
    rounds: Math.max(1, plan.round),
    toolCalls: count("tool_completed", "lab_tool_completed"),
    fallbacks: plan.sections.filter((section) => section.proposal?.source?.kind === "fallback")
      .length,
    failedAgents: count("agent_failed"),
    unresolvedConflicts: plan.conflicts?.length ?? 0,
    groundedSections: plan.sections.filter((section) =>
      GROUNDED_SOURCES.has(section.proposal?.source?.kind ?? ""),
    ).length,
    duplicateStops,
    genericStops: stops.filter((stop) => isGeneric(stop.location, cities)).length,
    multiCityConsistent: multiCityConsistent(scenario, plan),
    stopReason: stopped?.event.type === "lab_loop_stopped" ? stopped.event.reason : null,
    usage: {
      status: "unavailable",
      reason: "Fixture runs make no model calls, so no token or cost usage is recorded.",
    },
    eventCount: events.length,
  };
}

/** The same measurement, read back from a finished artifact; it must equal the stored metrics. */
export function recomputeAgentLabMetrics(
  artifact: AgentLabCompletedRunArtifact,
): AgentLabMeasurement {
  return measureAgentLabRun(
    findAgentLabScenario(artifact.scenarioId),
    artifact.plan,
    artifact.events,
  );
}
