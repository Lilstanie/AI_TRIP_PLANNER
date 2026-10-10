import type { AgentLabRunArtifact } from "@trip/shared";
import { stopReasonLabel } from "./comparison";

export type FaultOutcomeKind = "completed" | "degraded" | "partial" | "failed";

export interface FaultOutcome {
  kind: FaultOutcomeKind;

  label: string;
  headline: string;
  facts: string[];

  figures: {
    events: number;
    toolFailures: number;
    failedAgents: number;
    unavailableSections: number;
    unresolvedConflicts: number | null;

    stopReason: string | null;
  };
}

const labels: Record<FaultOutcomeKind, string> = {
  completed: "Completed",
  degraded: "Degraded",
  partial: "Partial result",
  failed: "Failed",
};

const name = (agent: string) => agent.replace(/-/g, " ");
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function faultOutcome(artifact: AgentLabRunArtifact): FaultOutcome {
  const events = artifact.events.map((entry) => entry.event);
  const of = <T extends (typeof events)[number]["type"]>(type: T) =>
    events.filter((event) => event.type === type) as Extract<
      (typeof events)[number],
      { type: T }
    >[];

  const toolFailed = of("tool_failed");
  const agentFailed = of("agent_failed");
  const rejected = of("lab_agent_output_rejected");
  const fallbacks = of("lab_supervisor_fallback");
  const unavailable =
    artifact.status === "completed"
      ? artifact.plan.sections.filter((section) => section.proposal?.source?.kind === "unavailable")
      : [];

  const figures: FaultOutcome["figures"] = {
    events: events.length,
    toolFailures: toolFailed.length,
    failedAgents: agentFailed.length,
    unavailableSections: unavailable.length,
    unresolvedConflicts:
      artifact.status === "completed" ? artifact.metrics.unresolvedConflicts : null,
    stopReason: artifact.status === "completed" ? (artifact.metrics.stopReason ?? "none") : null,
  };
  const outcome = (kind: FaultOutcomeKind, headline: string, facts: string[]): FaultOutcome => ({
    kind,
    label: labels[kind],
    headline,
    facts,
    figures,
  });

  if (artifact.status === "failed") {
    const agent = artifact.failure.agent;
    const facts = [
      `No plan was assembled; the ${plural(events.length, "event")} recorded before the failure were kept.`,
    ];
    for (const item of rejected) {
      facts.push(`Output rejected at the schema boundary: ${item.fields.join(", ")}.`);
    }
    if (agent) {
      const empty = of("tool_completed").some(
        (event) => event.agent === agent && event.resultCount === 0,
      );
      if (empty) {
        facts.push(
          `The ${name(agent)} search returned no results, and the workflow did not invent any.`,
        );
      }
      if (toolFailed.some((event) => event.agent === agent)) {
        facts.push(`The ${name(agent)} provider call failed.`);
      }
    }
    return outcome(
      "failed",
      agent
        ? `The ${name(agent)} specialist failed and the run stopped`
        : "The run failed and stopped",
      facts,
    );
  }

  const unresolved = artifact.metrics.unresolvedConflicts;
  const facts: string[] = [];
  for (const item of fallbacks) facts.push(item.summary);
  for (const section of unavailable) {
    facts.push(`The ${name(section.id)} section is unavailable and was not priced.`);
  }
  const notKept = of("lab_revision_scored").filter((event) => !event.kept);
  for (const item of notKept) {
    facts.push(
      `The revision moved the plan score from ${item.scoreBefore} to ${item.scoreAfter}, so the previous proposals stand.`,
    );
  }
  if (unresolved > 0) {
    facts.push(
      `${plural(unresolved, "conflict")} remain${unresolved === 1 ? "s" : ""} unresolved${
        artifact.metrics.stopReason
          ? ` (${stopReasonLabel(artifact.metrics.stopReason).toLowerCase()})`
          : ""
      }.`,
    );
  }

  if (fallbacks.length) {
    return outcome(
      "degraded",
      "The supervisor failed; the specialists were dispatched deterministically",
      facts,
    );
  }
  if (toolFailed.length) {
    const agents = [...new Set(toolFailed.map((event) => name(event.agent)))].join(", ");
    return outcome(
      "degraded",
      `The ${agents} provider call failed; the section is degraded`,
      facts,
    );
  }
  if (artifact.metrics.stopReason === "no_improvement") {
    return outcome(
      "partial",
      "A revision did not improve the plan; the best known plan was kept",
      facts,
    );
  }
  if (artifact.metrics.stopReason === "infeasible_budget") {
    return outcome(
      "completed",
      "The budget cannot be met, so the run stopped without revising",
      facts,
    );
  }
  if (unresolved > 0) {
    return outcome(
      "completed",
      `Completed with ${plural(unresolved, "unresolved conflict")}`,
      facts,
    );
  }
  return outcome("completed", "Completed without a failure", facts);
}
