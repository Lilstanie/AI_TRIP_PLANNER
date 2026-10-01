// Failure inventory, written before the module:
// - a displayed value is recomputed in the browser and drifts from the artifact it claims to show;
// - a strategy that has not run, was cancelled or failed shows a number (or a stale one from an
//   earlier run) instead of "Not run";
// - an over-budget plan is labelled "Within budget", or its overrun is shown as remaining money;
// - the check count counts failed checks as passed;
// - a one-sided comparison pretends to have a winner (the module must never rank the strategies).
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
});
