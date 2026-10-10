import { describe, expect, it } from "vitest";
import {
  AgentLabFailedRunArtifact,
  AgentLabRunRequest,
  type AgentLabEventPayload,
  type AgentLabRunArtifact,
} from "@trip/shared";
import {
  agentLabFaultProfiles,
  findAgentLabFaultProfile,
  isRegisteredAgentLabRun,
  runAgentLabToArtifact,
} from "../src/agent-lab";

const request = (faultProfileId: string) => {
  const profile = findAgentLabFaultProfile(faultProfileId as never);
  return {
    scenarioId: profile.scenarioId,
    strategyId: profile.strategyId,
    dataMode: "fixture" as const,
    faultProfileId: profile.id,
  };
};
const run = (id: string) => runAgentLabToArtifact(request(id), { paceMs: 0 });
const payloads = (artifact: AgentLabRunArtifact) => artifact.events.map((entry) => entry.event);
const ofType = <T extends AgentLabEventPayload["type"]>(
  artifact: AgentLabRunArtifact,
  type: T,
): Extract<AgentLabEventPayload, { type: T }>[] =>
  payloads(artifact).filter((event) => event.type === type) as never;

describe("registry", () => {
  it("registers the five profiles, each bound to one scenario and strategy", () => {
    expect(agentLabFaultProfiles.map((profile) => profile.id).sort()).toEqual([
      "invalid-agent-output",
      "provider-empty-result",
      "provider-timeout",
      "stalled-revision",
      "supervisor-failure",
    ]);
    for (const profile of agentLabFaultProfiles) {
      expect(profile.title.length).toBeGreaterThan(0);
      expect(profile.summary.length).toBeGreaterThan(0);
      expect(["degraded", "terminal", "partial"]).toContain(profile.expected);
      expect(profile.strategyId).toMatch(/^multi-agent-/);
    }
  });

  it("accepts only a registered profile on the scenario and strategy it was built for", () => {
    for (const profile of agentLabFaultProfiles) {
      expect(isRegisteredAgentLabRun(request(profile.id))).toBe(true);
    }
    const timeout = request("provider-timeout");
    expect(isRegisteredAgentLabRun({ ...timeout, strategyId: "single-agent-baseline" })).toBe(
      false,
    );
    expect(isRegisteredAgentLabRun({ ...timeout, scenarioId: "tokyo-couple-tight-budget" })).toBe(
      false,
    );
    expect(isRegisteredAgentLabRun({ ...timeout, faultProfileId: undefined })).toBe(true);
  });

  it("rejects an unknown profile, a fault the visitor defines and an extra property", () => {
    const valid = request("provider-timeout");
    expect(AgentLabRunRequest.safeParse(valid).success).toBe(true);
    for (const body of [
      { ...valid, faultProfileId: "disk-full" },
      { ...valid, faultProfileId: { tool: "searchFlights", error: "boom" } },
      { ...valid, fault: { tool: "searchFlights" } },
      { ...valid, faultProfileId: ["provider-timeout"] },
    ]) {
      expect(AgentLabRunRequest.safeParse(body).success).toBe(false);
    }
  });
});

describe("a clean run", () => {
  it("names no profile and carries no fault event", async () => {
    const artifact = await runAgentLabToArtifact(
      {
        scenarioId: "tokyo-couple",
        strategyId: "multi-agent-no-revision",
        dataMode: "fixture",
      },
      { paceMs: 0 },
    );
    expect(artifact.status).toBe("completed");
    expect(artifact.faultProfileId).toBeNull();
    expect(payloads(artifact).some((event) => event.type === "lab_fault_injected")).toBe(false);
  });
});

describe("provider-timeout", () => {
  it("degrades the transport section, says so and leaves the conflict visible", async () => {
    const artifact = await run("provider-timeout");
    expect(artifact.status).toBe("completed");
    if (artifact.status !== "completed") return;
    expect(artifact.faultProfileId).toBe("provider-timeout");

    const [injected] = ofType(artifact, "lab_fault_injected");
    expect(injected).toMatchObject({ profileId: "provider-timeout", capability: "transport" });
    expect(artifact.events[1]?.event.type).toBe("lab_fault_injected");

    const failed = ofType(artifact, "tool_failed");
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((event) => event.agent === "transport")).toBe(true);

    const transport = artifact.plan.sections.find((section) => section.id === "transport")!;
    expect(transport.proposal?.source?.kind).toBe("unavailable");
    expect(transport.estCost).toBe(0);
    expect(artifact.plan.conflicts?.some((item) => item.targetAgent === "transport")).toBe(true);
    expect(artifact.metrics.unresolvedConflicts).toBeGreaterThan(0);
    expect(artifact.metrics.failedAgents).toBe(0);
    expect(artifact.metrics.rounds).toBe(1);
  });
});

describe("provider-empty-result", () => {
  it("stops instead of inventing a stay, and names the capability", async () => {
    const artifact = await run("provider-empty-result");
    expect(artifact.status).toBe("failed");
    expect(AgentLabFailedRunArtifact.safeParse(artifact).success).toBe(true);
    if (artifact.status !== "failed") return;
    expect(artifact.faultProfileId).toBe("provider-empty-result");
    expect(artifact.failure).toMatchObject({ code: "agent_failed", agent: "accommodation" });
    expect(artifact.failure.atSequence).toBe(artifact.events.length);
    expect(artifact.metrics.eventCount).toBe(artifact.events.length);

    const searched = ofType(artifact, "tool_completed").filter(
      (event) => event.agent === "accommodation",
    );
    expect(searched.some((event) => event.resultCount === 0)).toBe(true);
    const failed = ofType(artifact, "agent_failed");
    expect(failed).toHaveLength(1);
    expect(failed[0]?.agent).toBe("accommodation");
    expect(ofType(artifact, "lab_plan_validated")).toHaveLength(0);
  });
});

describe("invalid-agent-output", () => {
  it("records the schema rejection in the trace and does not let the proposal through", async () => {
    const artifact = await run("invalid-agent-output");
    expect(artifact.status).toBe("failed");
    if (artifact.status !== "failed") return;
    expect(artifact.failure).toMatchObject({ code: "agent_failed", agent: "dining" });

    const rejected = ofType(artifact, "lab_agent_output_rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ agent: "dining", round: 1 });
    expect(rejected[0]!.fields).toContain("items");

    const types = payloads(artifact).map((event) => event.type);
    expect(types.indexOf("lab_agent_output_rejected")).toBeLessThan(types.indexOf("agent_failed"));
    expect(types).not.toContain("lab_plan_validated");
    expect(types).not.toContain("lab_evaluation_completed");
  });
});

describe("supervisor-failure", () => {
  it("falls back to deterministic dispatch visibly and still produces every section", async () => {
    const artifact = await run("supervisor-failure");
    expect(artifact.status).toBe("completed");
    if (artifact.status !== "completed") return;

    const fallback = ofType(artifact, "lab_supervisor_fallback");
    expect(fallback).toHaveLength(1);
    expect(fallback[0]).toMatchObject({ phase: "dispatch", round: 1 });
    expect(ofType(artifact, "lab_fault_injected")[0]).toMatchObject({ capability: "supervisor" });

    const types = payloads(artifact).map((event) => event.type);
    expect(types.indexOf("lab_supervisor_fallback")).toBeLessThan(types.indexOf("agent_started"));
    expect(artifact.plan.sections).toHaveLength(5);

    const started = ofType(artifact, "agent_started").map((event) => event.agent);
    expect(new Set(started).size).toBe(started.length);
    expect(artifact.metrics.rounds).toBe(1);
  });
});

describe("stalled-revision", () => {
  it("keeps the best known plan, stops and reports why", async () => {
    const artifact = await run("stalled-revision");
    expect(artifact.status).toBe("completed");
    if (artifact.status !== "completed") return;

    const started = ofType(artifact, "lab_revision_started");
    const scored = ofType(artifact, "lab_revision_scored");
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ agent: "transport" });
    expect(scored).toHaveLength(1);
    expect(scored[0]).toMatchObject({ kept: false });
    expect(scored[0]!.scoreAfter).toBeGreaterThanOrEqual(scored[0]!.scoreBefore);
    expect(ofType(artifact, "lab_loop_stopped")[0]).toMatchObject({ reason: "no_improvement" });

    const firstConflict = ofType(artifact, "lab_conflict_detected")[0]!;
    expect(artifact.metrics.stopReason).toBe("no_improvement");
    expect(artifact.metrics.unresolvedConflicts).toBeGreaterThan(0);
    expect(artifact.metrics.rounds).toBe(2);

    expect(firstConflict.score).toBe(scored[0]!.scoreBefore);
    expect(artifact.plan.conflicts?.length).toBe(firstConflict.conflicts.length);
  });
});

describe("evidence safety", () => {
  it.each(agentLabFaultProfiles.map((profile) => profile.id))(
    "%s leaks no stack, validator text, raw provider error or credential",
    async (id) => {
      const text = JSON.stringify(await run(id));
      for (const leak of [
        "DOMException",
        "TimeoutError",
        "ZodError",
        "aborted due to timeout",
        "expected array",
        "received null",
        "    at ",
        "node_modules",
        "apiKey",
        "sk-",
      ]) {
        expect(text).not.toContain(leak);
      }
    },
  );

  it("does not produce an artifact for a cancelled faulted run", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runAgentLabToArtifact(request("provider-empty-result"), {
        paceMs: 0,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});
