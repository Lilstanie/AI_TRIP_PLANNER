import { afterEach, describe, expect, it, vi } from "vitest";
import { agentLabStrategySupportsLive, buildAgentLabUsage, runAgentLab } from "../src/agent-lab";
import type { AgentLabRunRequest } from "@trip/shared";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const fixture = (strategyId: AgentLabRunRequest["strategyId"], extra = {}): AgentLabRunRequest => ({
  scenarioId: "tokyo-couple",
  strategyId,
  dataMode: "fixture",
  ...extra,
});

describe("a fixture run", () => {
  it.each([
    "single-agent-baseline",
    "multi-agent-no-revision",
    "multi-agent-targeted-revision",
  ] as const)(
    "%s makes no external call although keys are set and live data is the default",
    async (strategyId) => {
      vi.stubEnv("USE_MOCK_TOOLS", "false");
      for (const key of ["DEEPSEEK_API_KEY", "SERPAPI_KEY", "MAPS_API_KEY", "WEATHER_API_KEY"]) {
        vi.stubEnv(key, "test-key-not-real");
      }
      const network = vi.fn(async () => {
        throw new Error("network used");
      });
      vi.stubGlobal("fetch", network);
      const scenarioId =
        strategyId === "multi-agent-targeted-revision"
          ? "tokyo-couple-tight-budget"
          : "tokyo-couple";
      const artifact = await runAgentLab(
        { scenarioId, strategyId, dataMode: "fixture" },
        { paceMs: 0 },
      );
      expect(network).not.toHaveBeenCalled();
      expect(artifact.dataMode).toBe("fixture");
    },
  );

  it("reports usage as unavailable, never as a number", async () => {
    const artifact = await runAgentLab(fixture("multi-agent-no-revision"), { paceMs: 0 });
    expect(artifact.metrics.usage).toMatchObject({ status: "unavailable" });
  });
});

describe("a live run", () => {
  it("is offered only for strategies that have a live implementation", () => {
    expect(agentLabStrategySupportsLive("single-agent-baseline")).toBe(false);
    expect(agentLabStrategySupportsLive("multi-agent-no-revision")).toBe(true);
    expect(agentLabStrategySupportsLive("multi-agent-targeted-revision")).toBe(true);
  });

  it("refuses the scripted baseline instead of labelling a recording as live", async () => {
    await expect(
      runAgentLab({ ...fixture("single-agent-baseline"), dataMode: "live" }, { paceMs: 0 }),
    ).rejects.toThrow(/no live implementation/);
  });

  it("uses the real adapters, labels everything live and keeps private reasoning out of the trace", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "true");
    for (const key of ["DEEPSEEK_API_KEY", "SERPAPI_KEY", "MAPS_API_KEY", "WEATHER_API_KEY"]) {
      vi.stubEnv(key, "");
    }
    const network = vi.fn(
      async () =>
        new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", network);
    const seen: { dataMode: string; type: string }[] = [];

    const artifact = await runAgentLab(
      { ...fixture("multi-agent-no-revision"), dataMode: "live" },
      {
        paceMs: 0,
        onEvent: (entry) => {
          seen.push({ dataMode: entry.dataMode, type: entry.event.type });
        },
      },
    ).catch(() => undefined);

    expect(network).toHaveBeenCalled();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((entry) => entry.dataMode === "live")).toBe(true);
    expect(seen.some((entry) => entry.type === "agent_reasoning")).toBe(false);
    if (artifact) {
      expect(artifact.dataMode).toBe("live");
      expect(artifact.metrics.usage).toMatchObject({ status: "unavailable" });
      const text = JSON.stringify(artifact);
      for (const leak of ["Error:", "    at ", "node_modules", "TypeError"]) {
        expect(text).not.toContain(leak);
      }
    }
  });
});

describe("buildAgentLabUsage", () => {
  const snapshot = (calls: number, reported: number, input = 0, output = 0) => ({
    calls,
    reported,
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
  });

  it("is unavailable when no model call was made", () => {
    expect(buildAgentLabUsage(snapshot(0, 0))).toMatchObject({ status: "unavailable" });
    expect(buildAgentLabUsage(undefined)).toMatchObject({ status: "unavailable" });
  });

  it("is measured when every call reported", () => {
    expect(buildAgentLabUsage(snapshot(3, 3, 900, 120))).toEqual({
      status: "measured",
      modelCalls: 3,
      inputTokens: 900,
      outputTokens: 120,
      totalTokens: 1020,
    });
  });

  it("is unavailable, and says why, when some call reported nothing", () => {
    const usage = buildAgentLabUsage(snapshot(3, 2, 900, 120));
    expect(usage.status).toBe("unavailable");
    if (usage.status === "unavailable") expect(usage.reason).toMatch(/2 of 3/);
  });
});
