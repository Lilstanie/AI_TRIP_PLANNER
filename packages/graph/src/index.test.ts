import { describe, expect, it } from "vitest";
import { DEMO_BRIEF } from "@trip/orchestrator";
import { resumeGraph, runGraph } from "./index";

describe("langgraph orchestration", () => {
  it("converges on the demo brief exactly like runOrchestrator (round 2, USD 2380)", async () => {
    const { plan, awaitingUser } = await runGraph({ ...DEMO_BRIEF, tripId: "graph-demo-converge" });
    expect(plan.round).toBe(2);
    expect(plan.estTotal).toBe(2380);
    expect(plan.sections.find((s) => s.id === "accommodation")!.estCost).toBe(1480);
    expect(plan.hitl.some((c) => c.id === "confirm-brief")).toBe(true);
    // one pending checkpoint means the run parks at the HITL interrupt
    expect(awaitingUser).toBe(true);
  });

  it("pauses at the HITL interrupt and resumes with the user's decision", async () => {
    const threadId = "graph-demo-hitl";
    const first = await runGraph({ ...DEMO_BRIEF, tripId: threadId });
    expect(first.awaitingUser).toBe(true);
    expect(first.plan.hitl.find((c) => c.id === "confirm-brief")!.status).toBe("pending");

    const resumed = await resumeGraph(threadId, { "confirm-brief": "approved" });
    expect(resumed.awaitingUser).toBe(false);
    expect(resumed.plan.hitl.find((c) => c.id === "confirm-brief")!.status).toBe("approved");
  });

  it("escalates and still parks at HITL when the cheapest plan is over budget", async () => {
    const { plan } = await runGraph({
      ...DEMO_BRIEF,
      tripId: "graph-demo-escalate",
      budgetTotal: 1200,
    });
    expect(plan.round).toBe(3);
    expect(plan.hitl.some((c) => c.type === "escalation")).toBe(true);
  });
});
