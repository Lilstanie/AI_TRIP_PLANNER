import type { AgentLabCompletedRunArtifact } from "@trip/shared";
import { money } from "./format";

export interface ComparisonRow {
  id: string;
  label: string;
  /** One value per strategy, in the order the strategies were passed. */
  values: string[];
}

// Also covers a run that was cancelled or failed: it started, but it left no result to show.
const stopReasons: Record<NonNullable<Metrics["stopReason"]>, string> = {
  converged: "Converged",
  round_limit: "Round limit reached",
  infeasible_budget: "Infeasible budget",
  no_improvement: "No improvement",
};

/** A strategy with no planning loop has no stopping reason, and says so rather than inventing one. */
export const stopReasonLabel = (reason: Metrics["stopReason"]) =>
  reason ? stopReasons[reason] : "No loop";

/**
 * What happened to the conflicts a plan had, read from the metrics alone. A strategy with no planning
 * loop never checked, so it is not shown as having found none. An infeasible stop is its own outcome:
 * a conflict remains, but no revision could have removed it, which is not the same as an unrepaired one.
 */
export function conflictOutcomeLabel(metrics: Metrics): string {
  if (metrics.stopReason === null) return "Not checked";
  if (metrics.stopReason === "infeasible_budget") return "Infeasible budget";
  if (metrics.unresolvedConflicts > 0) return `Unresolved (${metrics.unresolvedConflicts} left)`;
  return metrics.rounds > 1 ? `Repaired in ${metrics.rounds} rounds` : "None found";
}

export const multiCityLabel = (consistent: boolean | null) =>
  consistent === null ? "Not applicable" : consistent ? "Consistent" : "Inconsistent";

/** Usage that was not measured is "Unavailable", never a zero that reads as free. */
const usageLabels = { unavailable: "Unavailable" } as const;
export const usageLabel = (usage: Metrics["usage"]) => usageLabels[usage.status];

export const NO_RESULT = "No completed run";

type Metrics = AgentLabCompletedRunArtifact["metrics"];

const rows: readonly { id: string; label: string; read: (metrics: Metrics) => string }[] = [
  { id: "latency", label: "Latency (fixture)", read: (m) => `${m.latencyMs} ms` },
  { id: "rounds", label: "Planning rounds", read: (m) => String(m.rounds) },
  { id: "tool-calls", label: "Tool calls", read: (m) => String(m.toolCalls) },
  { id: "fallbacks", label: "Fallback sections", read: (m) => String(m.fallbacks) },
  { id: "failed-agents", label: "Failed agents", read: (m) => String(m.failedAgents) },
  {
    id: "budget",
    label: "Budget",
    read: (m) =>
      m.withinBudget
        ? `Within budget, ${money(m.budgetHeadroom)} remaining`
        : `Over budget by ${money(-m.budgetHeadroom)}`,
  },
  { id: "conflicts", label: "Unresolved conflicts", read: (m) => String(m.unresolvedConflicts) },
  { id: "conflict-outcome", label: "Conflict outcome", read: conflictOutcomeLabel },
  {
    id: "checks",
    label: "Deterministic checks",
    read: (m) => `${m.checks.filter((check) => check.passed).length}/${m.checks.length} passed`,
  },
  {
    id: "grounding",
    label: "Grounded sections",
    read: (m) => `${m.groundedSections}/${m.sectionCount} sections`,
  },
  { id: "duplicate-stops", label: "Repeated stops", read: (m) => String(m.duplicateStops) },
  { id: "generic-stops", label: "Generic stops", read: (m) => String(m.genericStops) },
  {
    id: "multi-city",
    label: "Multi-city consistency",
    read: (m) => multiCityLabel(m.multiCityConsistent),
  },
  { id: "stop-reason", label: "Stopping reason", read: (m) => stopReasonLabel(m.stopReason) },
  { id: "usage", label: "Token and model cost", read: (m) => usageLabel(m.usage) },
];

/**
 * Side-by-side figures for any number of strategies. Every value is read from that run's own artifact,
 * so the page can never show a number the artifact does not hold; a strategy without a completed
 * artifact shows "No completed run". The rows deliberately carry no ranking.
 */
export function buildComparisonRows(
  ...runs: (AgentLabCompletedRunArtifact | undefined)[]
): ComparisonRow[] {
  return rows.map(({ id, label, read }) => ({
    id,
    label,
    values: runs.map((run) => (run ? read(run.metrics) : NO_RESULT)),
  }));
}
