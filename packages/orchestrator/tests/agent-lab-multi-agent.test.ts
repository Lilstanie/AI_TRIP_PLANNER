import { describe, expect, it } from "vitest";
import type { AgentLabRunEvent, Specialist } from "@trip/shared";
import {
  createMultiAgentFixtureStrategy,
  findAgentLabScenario,
  runAgentLab,
} from "../src/agent-lab";

const scenario = findAgentLabScenario("tokyo-couple");
const request = {
  scenarioId: "tokyo-couple",
  strategyId: "multi-agent-no-revision",
  dataMode: "fixture",
} as const;
const baseline = { ...request, strategyId: "single-agent-baseline" } as const;

const payloads = (events: AgentLabRunEvent[]) => events.map((runEvent) => runEvent.event);

describe("multi-agent no-revision strategy", () => {
  it("is deterministic: two runs agree on the plan and every event payload", async () => {
    const [first, second] = [
      await runAgentLab(request, { paceMs: 0 }),
      await runAgentLab(request, { paceMs: 0 }),
    ];
    expect(second.plan).toEqual(first.plan);
    expect(payloads(second.events)).toEqual(payloads(first.events));
  });

  it("uses the scenario's own preferences, not a stored traveller profile", async () => {
    const { plan } = await runAgentLab(request, { paceMs: 0 });
    const dining = plan.sections.find((section) => section.id === "dining")!.proposal!;
    expect(dining.assumptions.join(" ")).toMatch(/Applied confirmed dietary preferences/);
    expect(dining.assumptions.join(" ")).toMatch(/vegetarian/i);
  });

  it("runs exactly one round and never reaches the revision node, even with conflicts", async () => {
    const tight = { ...scenario, brief: { ...scenario.brief, budgetTotal: 1500 } };
    const events: unknown[] = [];
    const plan = await createMultiAgentFixtureStrategy().run({
      scenario: tight,
      signal: new AbortController().signal,
      emit: async (event) => void events.push(event),
    });
    expect(plan.round).toBe(1);
    expect((plan.conflicts ?? []).length).toBeGreaterThan(0);
    const phases = events.flatMap((event: any) =>
      event.type === "coordinator" ? [event.phase] : [],
    );
    expect(phases).toEqual(["dispatch", "conflicts", "assembly"]);
    expect(events.some((event: any) => event.type === "agent_started" && event.round > 1)).toBe(
      false,
    );
  });

  it("attributes every tool call to a specialist and completes each one", async () => {
    const { events } = await runAgentLab(request, { paceMs: 0 });
    const tools = payloads(events).flatMap((event) =>
      event.type === "tool_started" || event.type === "tool_completed" ? [event] : [],
    );
    expect(tools.length).toBeGreaterThan(0);
    const started = tools.filter((event) => event.type === "tool_started");
    const completed = tools.filter((event) => event.type === "tool_completed");
    expect(completed.map((event) => event.callId).sort()).toEqual(
      started.map((event) => event.callId).sort(),
    );
    for (const event of tools)
      expect(event.agent).toMatch(/^(itinerary|transport|accommodation|destination-guide|dining)$/);
  });

  it("reports metrics that agree with the trace", async () => {
    const artifact = await runAgentLab(request, { paceMs: 0 });
    const types = payloads(artifact.events).map((event) => event.type);
    expect(artifact.metrics.toolCalls).toBe(
      types.filter((type) => type === "tool_completed").length,
    );
    expect(artifact.metrics.failedAgents).toBe(0);
    expect(artifact.metrics.rounds).toBe(1);
    expect(artifact.metrics.unresolvedConflicts).toBe((artifact.plan.conflicts ?? []).length);
    expect(artifact.metrics.fallbacks).toBe(
      artifact.plan.sections.filter((section) => section.proposal?.source?.kind === "fallback")
        .length,
    );
    expect(artifact.metrics.checks.length).toBeGreaterThanOrEqual(6);
  });

  it("counts a failing specialist in the trace and rejects the run", async () => {
    const broken: Specialist = {
      name: "dining",
      label: "Food",
      supportsRevision: false,
      invoke: async () => {
        throw new Error("provider exploded: secret-token");
      },
    } as Specialist;
    const { allSpecialists } = await import("@trip/agents");
    const specialists = allSpecialists.map((specialist) =>
      specialist.name === "dining" ? broken : specialist,
    );
    const events: any[] = [];
    await expect(
      createMultiAgentFixtureStrategy({ specialists }).run({
        scenario,
        signal: new AbortController().signal,
        emit: async (event) => void events.push(event),
      }),
    ).rejects.toThrow();
    const failed = events.filter((event) => event.type === "agent_failed");
    expect(failed.map((event) => event.agent)).toEqual(["dining"]);
    expect(JSON.stringify(events)).not.toContain("secret-token");
  });

  it("excludes display pacing from latency", async () => {
    const artifact = await runAgentLab(request, { paceMs: 60 });
    const paced = 60 * artifact.events.length;
    expect(artifact.metrics.durationMs).toBeGreaterThanOrEqual(paced - 60);
    expect(artifact.metrics.latencyMs).toBeLessThan(paced / 2);
  });

  it("stops without a result when cancelled mid-run", async () => {
    const controller = new AbortController();
    const seen: number[] = [];
    const run = runAgentLab(request, {
      paceMs: 40,
      signal: controller.signal,
      onEvent: (event) => {
        seen.push(event.sequence);
        if (event.sequence === 3) controller.abort();
      },
    });
    await expect(run).rejects.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(Math.max(...seen)).toBeLessThanOrEqual(4);
  });
});

describe("equivalent evidence for both strategies", () => {
  it("shares the same fare and stay between the baseline and the specialists", async () => {
    const [single, multi] = [
      await runAgentLab(baseline, { paceMs: 0 }),
      await runAgentLab(request, { paceMs: 0 }),
    ];
    const cost = (artifact: typeof single, section: string, kind: string) =>
      artifact.plan.sections
        .find((candidate) => candidate.id === section)!
        .proposal!.items.filter((item) => item.kind === kind)
        .reduce((sum, item) => sum + (item.estCost ?? 0), 0);
    expect(cost(single, "transport", "flight")).toBe(cost(multi, "transport", "transport"));
    expect(cost(single, "accommodation", "hotel")).toBe(cost(multi, "accommodation", "hotel"));
    expect(single.plan.brief).toEqual(multi.plan.brief);
  });
});
