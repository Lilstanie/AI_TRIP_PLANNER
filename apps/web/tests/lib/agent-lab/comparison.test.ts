// Failure inventory, written before the module:
// - a displayed value is recomputed in the browser and drifts from the artifact it claims to show;
// - a strategy that has not run, was cancelled or failed shows a number (or a stale one from an
//   earlier run) instead of "Not run";
// - an over-budget plan is labelled "Within budget", or its overrun is shown as remaining money;
// - the check count counts failed checks as passed;
// - a one-sided comparison pretends to have a winner (the module must never rank the strategies);
// - unavailable token or cost usage is shown as 0, or a missing stop reason as a reason;
// - a single-city trip is shown as "Consistent" for multi-city;
// - a third strategy is dropped, or its values land in another strategy's column;
// - a conflict outcome blurs a conflict that was repaired, one left unresolved and an infeasible budget
//   no revision could repair, or calls an infeasible stop "unresolved" because a conflict remains;
// - a strategy with no planning loop is shown as having found no conflicts, when it never checked.
import { describe, expect, it } from "vitest";
import type { AgentLabCompletedRunArtifact } from "@trip/shared";
import { buildComparisonRows } from "@/lib/agent-lab/comparison";

const artifact = (overrides: Partial<AgentLabCompletedRunArtifact["metrics"]> = {}) =>
  ({
    metrics: {
      withinBudget: true,
      budgetHeadroom: 2040,
      sectionCount: 5,
      checks: [
        { id: "a", label: "A", passed: true },
        { id: "b", label: "B", passed: false },
      ],
      eventCount: 8,
      durationMs: 700,
      latencyMs: 4,
      rounds: 1,
      toolCalls: 6,
      fallbacks: 3,
      failedAgents: 0,
      unresolvedConflicts: 0,
      groundedSections: 5,
      duplicateStops: 0,
      genericStops: 0,
      multiCityConsistent: null,
      stopReason: null,
      usage: { status: "unavailable", reason: "Fixture runs make no model calls." },
      ...overrides,
    },
  }) as AgentLabCompletedRunArtifact;

const value = (rows: ReturnType<typeof buildComparisonRows>, id: string, side: 0 | 1) =>
  rows.find((row) => row.id === id)!.values[side];

describe("buildComparisonRows", () => {
  it("reads every value from the artifact's own metrics", () => {
    const rows = buildComparisonRows(
      artifact(),
      artifact({ latencyMs: 40, rounds: 1, toolCalls: 9, fallbacks: 2 }),
    );
    expect(value(rows, "latency", 0)).toBe("4 ms");
    expect(value(rows, "latency", 1)).toBe("40 ms");
    expect(value(rows, "tool-calls", 1)).toBe("9");
    expect(value(rows, "fallbacks", 1)).toBe("2");
    expect(value(rows, "rounds", 0)).toBe("1");
    expect(value(rows, "failed-agents", 0)).toBe("0");
    expect(value(rows, "conflicts", 0)).toBe("0");
  });

  it("counts only passed checks", () => {
    expect(value(buildComparisonRows(artifact(), undefined), "checks", 0)).toBe("1/2 passed");
  });

  it("labels an overrun as over budget with the amount", () => {
    const rows = buildComparisonRows(
      artifact({ withinBudget: false, budgetHeadroom: -500 }),
      artifact(),
    );
    expect(value(rows, "budget", 0)).toBe("Over budget by A$500");
    expect(value(rows, "budget", 1)).toBe("Within budget, A$2,040 remaining");
  });

  it("shows No completed run for a strategy without a completed artifact", () => {
    const rows = buildComparisonRows(artifact(), undefined);
    for (const row of rows) expect(row.values[1]).toBe("No completed run");
  });

  it("never ranks the strategies", () => {
    const rows = buildComparisonRows(artifact(), artifact());
    expect(JSON.stringify(rows)).not.toMatch(/winner|better|best|worse/i);
  });

  it("keeps three strategies in their own columns", () => {
    const rows = buildComparisonRows(
      artifact({ rounds: 1 }),
      artifact({ rounds: 1 }),
      artifact({ rounds: 3, toolCalls: 12 }),
    );
    expect(rows.find((row) => row.id === "rounds")!.values).toEqual(["1", "1", "3"]);
    expect(rows.find((row) => row.id === "tool-calls")!.values).toEqual(["6", "6", "12"]);
    expect(
      buildComparisonRows(artifact(), artifact()).every((row) => row.values.length === 2),
    ).toBe(true);
  });

  it("shows unavailable usage as Unavailable, never as a number", () => {
    const rows = buildComparisonRows(artifact());
    expect(value(rows, "usage", 0)).toBe("Unavailable");
    expect(value(rows, "usage", 0)).not.toMatch(/\d/);
  });

  it("states grounding, repeated and generic stops and the stop reason from the metrics", () => {
    const rows = buildComparisonRows(
      artifact({
        groundedSections: 2,
        duplicateStops: 3,
        genericStops: 4,
        stopReason: "no_improvement",
      }),
      artifact(),
    );
    expect(value(rows, "grounding", 0)).toBe("2/5 sections");
    expect(value(rows, "duplicate-stops", 0)).toBe("3");
    expect(value(rows, "generic-stops", 0)).toBe("4");
    expect(value(rows, "stop-reason", 0)).toBe("No improvement");
    expect(value(rows, "stop-reason", 1)).toBe("No loop");
  });

  it("tells an infeasible stop, an unrepaired conflict and a repaired one apart", () => {
    const outcome = (overrides: Partial<AgentLabCompletedRunArtifact["metrics"]>) =>
      value(buildComparisonRows(artifact(overrides)), "conflict-outcome", 0);
    expect(outcome({ stopReason: "infeasible_budget", unresolvedConflicts: 1 })).toBe(
      "Infeasible budget",
    );
    expect(outcome({ stopReason: "round_limit", unresolvedConflicts: 1 })).toBe(
      "Unresolved (1 left)",
    );
    expect(outcome({ stopReason: "no_improvement", unresolvedConflicts: 2 })).toBe(
      "Unresolved (2 left)",
    );
    expect(outcome({ stopReason: "converged", unresolvedConflicts: 0, rounds: 2 })).toBe(
      "Repaired in 2 rounds",
    );
    expect(outcome({ stopReason: "converged", unresolvedConflicts: 0, rounds: 1 })).toBe(
      "None found",
    );
  });

  it("says a strategy with no planning loop never checked for conflicts", () => {
    const rows = buildComparisonRows(
      artifact({ stopReason: null, withinBudget: false, budgetHeadroom: -880 }),
      undefined,
    );
    expect(value(rows, "conflict-outcome", 0)).toBe("Not checked");
    expect(value(rows, "conflict-outcome", 1)).toBe("No completed run");
  });

  it("labels multi-city consistency as not applicable, consistent or inconsistent", () => {
    const at = (multiCityConsistent: boolean | null) =>
      value(buildComparisonRows(artifact({ multiCityConsistent })), "multi-city", 0);
    expect(at(null)).toBe("Not applicable");
    expect(at(true)).toBe("Consistent");
    expect(at(false)).toBe("Inconsistent");
  });
});
