import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentLabRunRequest } from "@trip/shared";
import { runAgentLab } from "../src/agent-lab";

const output = resolve(
  process.cwd(),
  "../../output/e2e/TP-21",
  process.env.RUN_ID ?? new Date().toISOString().replaceAll(/[:.]/g, "-"),
);
const record = resolve(process.cwd(), "../../submission/stage2/agent-lab-exit-paths.md");

const exitPaths: { path: string; request: AgentLabRunRequest }[] = [
  {
    path: "No conflict",
    request: {
      scenarioId: "tokyo-couple",
      strategyId: "multi-agent-targeted-revision",
      dataMode: "fixture",
    },
  },
  {
    path: "Resolved by revision",
    request: {
      scenarioId: "tokyo-couple-tight-budget",
      strategyId: "multi-agent-targeted-revision",
      dataMode: "fixture",
    },
  },
  {
    path: "Stalled",
    request: {
      scenarioId: "tokyo-couple-tight-budget",
      strategyId: "multi-agent-targeted-revision",
      dataMode: "fixture",
      faultProfileId: "stalled-revision",
    },
  },
  {
    path: "Round limit",
    request: {
      scenarioId: "tokyo-couple-tight-budget",
      strategyId: "multi-agent-no-revision",
      dataMode: "fixture",
    },
  },
  {
    path: "Infeasible",
    request: {
      scenarioId: "paris-family-infeasible",
      strategyId: "multi-agent-targeted-revision",
      dataMode: "fixture",
    },
  },
  {
    path: "Single-agent baseline",
    request: {
      scenarioId: "tokyo-couple-tight-budget",
      strategyId: "single-agent-baseline",
      dataMode: "fixture",
    },
  },
];

const expected: Record<string, { stop: string; rounds: number; unresolved: number }> = {
  "No conflict": { stop: "converged", rounds: 1, unresolved: 0 },
  "Resolved by revision": { stop: "converged", rounds: 2, unresolved: 0 },
  Stalled: { stop: "no_improvement", rounds: 2, unresolved: 1 },
  "Round limit": { stop: "round_limit", rounds: 1, unresolved: 1 },
  Infeasible: { stop: "infeasible_budget", rounds: 1, unresolved: 1 },
  "Single-agent baseline": { stop: "none", rounds: 1, unresolved: 0 },
};

const recordedRows = () =>
  readFileSync(record, "utf8")
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line))
    .slice(1)
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim().replaceAll("`", "")),
    );

describe("TP-21 Agent Lab exit paths", () => {
  it("records one repeatable fixture run for every way the planning loop stops", async () => {
    mkdirSync(output, { recursive: true });
    const rows: string[][] = [];
    for (const { path, request } of exitPaths) {
      const artifact = await runAgentLab(request, { paceMs: 0 });
      const { metrics } = artifact;
      writeFileSync(
        resolve(output, `${path.toLowerCase().replaceAll(/[^a-z]+/g, "-")}.json`),
        `${JSON.stringify(artifact, null, 2)}\n`,
      );
      const row = [
        path,
        request.scenarioId,
        request.strategyId,
        request.faultProfileId ?? "none",
        metrics.stopReason ?? "none",
        String(metrics.rounds),
        String(metrics.unresolvedConflicts),
        String(artifact.plan.budgetTotal),
        String(artifact.plan.estTotal),
        metrics.withinBudget ? "yes" : "no",
        metrics.checks.every((check) => check.passed) ? "yes" : "no",
      ];
      expect(
        { stop: row[4], rounds: metrics.rounds, unresolved: metrics.unresolvedConflicts },
        path,
      ).toEqual(expected[path]);
      rows.push(row);
    }
    writeFileSync(resolve(output, "summary.json"), `${JSON.stringify(rows, null, 2)}\n`);
    expect(recordedRows()).toEqual(rows);
  });
});
