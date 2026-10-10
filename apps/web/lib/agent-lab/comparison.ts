import type { AgentLabCompletedRunArtifact } from "@trip/shared";
import { labMoney } from "./money";

export interface ComparisonRow {
  id: string;
  label: string;

  values: string[];
}

const stopReasons: Record<NonNullable<Metrics["stopReason"]>, string> = {
  converged: "Converged",
  round_limit: "Round limit reached",
  infeasible_budget: "Infeasible budget",
  no_improvement: "No improvement",
};

export const stopReasonLabel = (reason: Metrics["stopReason"]) =>
  reason ? stopReasons[reason] : "No loop";

export function conflictOutcomeLabel(metrics: Metrics): string {
  if (metrics.stopReason === null) return "Not checked";
  if (metrics.stopReason === "infeasible_budget") return "Infeasible budget";
  if (metrics.unresolvedConflicts > 0) return `Unresolved (${metrics.unresolvedConflicts} left)`;
  return metrics.rounds > 1 ? `Repaired in ${metrics.rounds} rounds` : "None found";
}

export const multiCityLabel = (consistent: boolean | null) =>
  consistent === null ? "Not applicable" : consistent ? "Consistent" : "Inconsistent";

export const usageLabel = (usage: Metrics["usage"]) =>
  usage.status === "unavailable"
    ? "Unavailable"
    : `${usage.totalTokens.toLocaleString("en-AU")} tokens in ${usage.modelCalls} model ${
        usage.modelCalls === 1 ? "call" : "calls"
      }; cost not reported`;

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
        ? `Within budget, ${labMoney.money(m.budgetHeadroom)} remaining`
        : `Over budget by ${labMoney.money(-m.budgetHeadroom)}`,
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

export function buildComparisonRows(
  ...runs: (AgentLabCompletedRunArtifact | undefined)[]
): ComparisonRow[] {
  return rows.map(({ id, label, read }) => ({
    id,
    label,
    values: runs.map((run) => (run ? read(run.metrics) : NO_RESULT)),
  }));
}
