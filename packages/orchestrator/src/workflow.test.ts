import { describe, expect, it, vi } from "vitest";
import type {
  AgentName,
  AgentProposal,
  AgentProgressEvent,
  MemoryStore,
  Specialist,
  SpecialistRequest,
  ToolGateway,
  TripBrief,
} from "@trip/shared";
import { createOrchestratorGraph, detectConflicts, runOrchestrator } from "./workflow";

const brief: TripBrief = {
  tripId: "graph-test",
  userId: "graph-user",
  destination: "Sydney",
  dates: ["2026-10-01", "2026-10-04"],
  groupSize: 2,
  budgetTotal: 1000,
};

const tools: ToolGateway = {
  maps: {
    route: vi.fn(async () => []),
    places: vi.fn(async () => []),
  },
  booking: {
    searchStays: vi.fn(async () => []),
    searchFlights: vi.fn(async () => []),
  },
};

const mem: MemoryStore = {
  getShortTerm: vi.fn(async () => []),
  appendShortTerm: vi.fn(async () => {}),
  getLongTerm: vi.fn(async () => []),
  setLongTerm: vi.fn(async () => {}),
  promote: vi.fn(async () => {}),
};

function proposal(agent: AgentName, cost: number): AgentProposal {
  return {
    agent,
    summary: `${agent} proposal`,
    items: [{ kind: "estimate", detail: "Selected option", estCost: cost }],
    assumptions: [],
    conflictsWith: [],
  };
}

function agent(
  name: AgentName,
  initialCost: number,
  revise?: (request: SpecialistRequest) => Promise<AgentProposal>,
): Specialist & { invoke: ReturnType<typeof vi.fn> } {
  return {
    name,
    label: `${name} label`,
    supportsRevision: Boolean(revise),
    invoke: vi.fn(async (request: SpecialistRequest) =>
      request.revision && revise ? revise(request) : proposal(name, initialCost),
    ),
  };
}

describe("LangGraph orchestrator workflow", () => {
  it("exposes the named workflow nodes and preserves the TripPlan API", async () => {
    const itinerary = agent("itinerary", 400);
    const graph = createOrchestratorGraph({ specialists: [itinerary], tools, mem });
    const mermaid = graph.getGraph().drawMermaid();

    expect(mermaid).toContain("dispatch_specialists");
    expect(mermaid).toContain("detect_conflicts");
    expect(mermaid).toContain("revise_conflicts");
    expect(mermaid).toContain("build_plan");

    const plan = await runOrchestrator(brief, { specialists: [itinerary], tools, mem });
    expect(plan).toMatchObject({ tripId: brief.tripId, round: 1, estTotal: 400 });
    expect(plan.sections[0]).toMatchObject({ id: "itinerary", label: "itinerary label" });
    expect(itinerary.invoke).toHaveBeenCalledWith({
      brief,
      context: expect.objectContaining({ tripId: brief.tripId, round: 1, tools, mem }),
    });
  });

  it("runs targeted revision nodes concurrently and converges", async () => {
    const started: AgentName[] = [];
    let release: (() => void) | undefined;
    const bothStarted = new Promise<void>((resolve) => {
      release = resolve;
    });
    const revise = (name: AgentName, cost: number) =>
      vi.fn(async ({ context: ctx }: SpecialistRequest) => {
        started.push(name);
        if (started.length === 2) release?.();
        await bothStarted;
        expect(ctx.round).toBe(2);
        return proposal(name, cost);
      });
    const accommodation = agent("accommodation", 700, revise("accommodation", 400));
    const transport = agent("transport", 500, revise("transport", 300));

    const plan = await runOrchestrator(brief, {
      specialists: [accommodation, transport],
      tools,
      mem,
    });

    expect(started).toEqual(expect.arrayContaining(["accommodation", "transport"]));
    expect(plan).toMatchObject({ round: 2, estTotal: 700 });
    expect(plan.hitl.some((checkpoint) => checkpoint.type === "escalation")).toBe(false);
  });

  it("reports specialist lifecycle progress for the UI", async () => {
    const itinerary = agent("itinerary", 400);
    const events: AgentProgressEvent[] = [];

    await runOrchestrator(brief, {
      specialists: [itinerary],
      tools,
      mem,
      onProgress: (event) => events.push(event),
    });

    expect(events).toEqual([
      { type: "agent_started", agent: "itinerary", round: 1 },
      { type: "agent_completed", agent: "itinerary", round: 1 },
    ]);
  });

  it("targets itinerary when activity and transport schedules overlap", () => {
    const requests = detectConflicts(
      [
        {
          ...proposal("itinerary", 100),
          items: [
            {
              kind: "activity",
              detail: "Museum",
              day: 2,
              startTime: "09:00",
              endTime: "12:00",
              location: "Museum",
              estCost: 100,
            },
          ],
          conflictsWith: ["geography conflict on day 2: route needs more time"],
        },
        {
          ...proposal("transport", 50),
          items: [
            {
              kind: "transport",
              detail: "Train",
              day: 2,
              startTime: "10:00",
              endTime: "11:30",
              location: "Station",
              estCost: 50,
            },
          ],
        },
      ],
      { ...brief, budgetTotal: 1000 },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ targetAgent: "itinerary" });
    expect(requests[0]!.reason).toContain("geography conflict");
    expect(requests[0]!.reason).toContain("time overlap on day 2");
    expect(requests[0]!.constraints).toContain("make the route geographically feasible");
    // The revising agent cannot see the other proposals, so the constraint has
    // to name the window it must avoid and who holds it.
    const rescheduleConstraint = requests[0]!.constraints.find((constraint) =>
      constraint.includes("reschedule"),
    );
    expect(rescheduleConstraint).toContain("day 2");
    expect(rescheduleConstraint).toContain("10:00-11:30");
    expect(rescheduleConstraint).toContain("transport");
    expect(rescheduleConstraint).toContain("without changing trip dates");
  });

  it("ends at the configured round limit and marks unresolved sections", async () => {
    const accommodation = agent("accommodation", 1200);
    const plan = await runOrchestrator(brief, {
      specialists: [accommodation],
      tools,
      mem,
      maxRounds: 2,
    });

    expect(plan.round).toBe(2);
    expect(plan.sections[0]!.status).toBe("needs_you");
    expect(plan.hitl).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "escalation",
          detail: expect.stringContaining("2 rounds"),
        }),
      ]),
    );
  });

  describe("HITL decision execution", () => {
    it("surfaces a pending confirm-plan checkpoint once the negotiation converges", async () => {
      const itinerary = agent("itinerary", 400);
      const plan = await runOrchestrator(brief, { specialists: [itinerary], tools, mem });

      expect(plan.hitl).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "confirm-plan", type: "confirm_plan", status: "pending" }),
        ]),
      );
      // Not confirmed yet — nobody has approved it.
      expect(plan.sections[0]!.status).toBe("draft");
    });

    it("locks sections in as confirmed once confirm-plan is approved", async () => {
      const itinerary = agent("itinerary", 400);
      const plan = await runOrchestrator(brief, {
        specialists: [itinerary],
        tools,
        mem,
        decisions: [{ checkpointId: "confirm-plan", decision: "approve" }],
      });

      expect(plan.hitl).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "confirm-plan", status: "approved" })]),
      );
      expect(plan.sections[0]!.status).toBe("confirmed");
    });

    it("records a rejection without confirming sections", async () => {
      const itinerary = agent("itinerary", 400);
      const plan = await runOrchestrator(brief, {
        specialists: [itinerary],
        tools,
        mem,
        decisions: [{ checkpointId: "confirm-plan", decision: "reject" }],
      });

      expect(plan.hitl).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "confirm-plan", status: "rejected" })]),
      );
      expect(plan.sections[0]!.status).toBe("draft");
    });

    it("ignores a decision whose checkpoint id no longer matches anything", async () => {
      const itinerary = agent("itinerary", 400);
      const plan = await runOrchestrator(brief, {
        specialists: [itinerary],
        tools,
        mem,
        decisions: [{ checkpointId: "some-stale-id-from-an-old-brief", decision: "approve" }],
      });

      expect(plan.hitl.find((checkpoint) => checkpoint.id === "confirm-plan")!.status).toBe(
        "pending",
      );
      expect(plan.sections[0]!.status).toBe("draft");
    });

    it("approving the escalation checkpoint unblocks a section without claiming it converged", async () => {
      const accommodation = agent("accommodation", 1200);
      const plan = await runOrchestrator(brief, {
        specialists: [accommodation],
        tools,
        mem,
        maxRounds: 2,
        decisions: [{ checkpointId: "escalation", decision: "approve" }],
      });

      expect(plan.hitl).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "escalation", status: "approved" })]),
      );
      // The human overrode the block, but the agents never actually agreed —
      // that's "draft", not "confirmed" (confirmed is only for a clean converge).
      expect(plan.sections[0]!.status).toBe("draft");
    });

    it("rejecting the escalation checkpoint leaves the section blocked", async () => {
      const accommodation = agent("accommodation", 1200);
      const plan = await runOrchestrator(brief, {
        specialists: [accommodation],
        tools,
        mem,
        maxRounds: 2,
        decisions: [{ checkpointId: "escalation", decision: "reject" }],
      });

      expect(plan.sections[0]!.status).toBe("needs_you");
    });
  });

  it("rejects invalid graph configuration before running agents", () => {
    const duplicate = agent("itinerary", 100);
    expect(() => createOrchestratorGraph({ specialists: [], tools, mem })).toThrow(
      "at least one specialist",
    );
    expect(() =>
      createOrchestratorGraph({ specialists: [duplicate, duplicate], tools, mem }),
    ).toThrow("unique");
    expect(() =>
      createOrchestratorGraph({ specialists: [duplicate], tools, mem, maxRounds: 0 }),
    ).toThrow("positive integer");
  });
});
