import type { AgentLabCompletedRunArtifact } from "@trip/shared";
import { money } from "./format";

export interface ComparisonRow {
  id: string;
  label: string;
  /** Single-agent first, multi-agent second. */
  values: [string, string];
}

// Also covers a run that was cancelled or failed: it started, but it left no result to show.
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
  {
    id: "checks",
    label: "Deterministic checks",
    read: (m) => `${m.checks.filter((check) => check.passed).length}/${m.checks.length} passed`,
  },
];

/**
 * Side-by-side figures for the two strategies. Every value is read from that run's own artifact, so
 * the page can never show a number the artifact does not hold; a strategy without a completed
 * artifact shows "No completed run". The rows deliberately carry no ranking.
 */
export function buildComparisonRows(
  single: AgentLabCompletedRunArtifact | undefined,
  multi: AgentLabCompletedRunArtifact | undefined,
): ComparisonRow[] {
  return rows.map(({ id, label, read }) => ({
    id,
    label,
    values: [single ? read(single.metrics) : NO_RESULT, multi ? read(multi.metrics) : NO_RESULT],
  }));
}
