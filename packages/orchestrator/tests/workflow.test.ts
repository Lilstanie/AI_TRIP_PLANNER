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
import { createOrchestratorGraph, detectConflicts, runOrchestrator } from "../src/workflow";

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
    // Nothing is unresolved after the revision, so every section is a draft.
    expect(plan.conflicts).toEqual([]);
    expect(plan.sections.every((section) => section.status === "draft")).toBe(true);
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

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "agent_started",
          agent: "itinerary",
          round: 1,
          summary: expect.any(String),
        }),
        expect.objectContaining({
          type: "agent_completed",
          agent: "itinerary",
          round: 1,
          summary: expect.any(String),
        }),
        expect.objectContaining({ type: "coordinator", phase: "conflicts" }),
        expect.objectContaining({ type: "coordinator", phase: "assembly" }),
      ]),
    );
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

  it("asks only the itinerary to move when an activity collides with transport", () => {
    // A deliberate asymmetry, and load-bearing now that transport chooses its own
    // departure times: a train leaves when it leaves, a museum visit does not. Making
    // this symmetric asks both sides to reschedule around each other, which can burn
    // every remaining round without converging.
    const at = (agent: AgentName, kind: string, startTime: string, endTime: string) => ({
      ...proposal(agent, 100),
      items: [{ kind, detail: kind, day: 2, startTime, endTime, location: kind, estCost: 100 }],
    });
    const requests = detectConflicts(
      [
        at("itinerary", "activity", "10:00", "12:00"),
        at("transport", "transport", "11:00", "13:00"),
      ],
      { ...brief, budgetTotal: 100000 },
    );
    expect(requests.map((request) => request.targetAgent)).toEqual(["itinerary"]);
  });

  it("asks both sides to move when neither is the itinerary", () => {
    const at = (agent: AgentName, kind: string, startTime: string, endTime: string) => ({
      ...proposal(agent, 100),
      items: [{ kind, detail: kind, day: 2, startTime, endTime, location: kind, estCost: 100 }],
    });
    const requests = detectConflicts(
      [at("transport", "transport", "10:00", "12:00"), at("dining", "meal", "11:00", "13:00")],
      { ...brief, budgetTotal: 100000 },
    );
    expect(requests.map((request) => request.targetAgent).sort()).toEqual(["dining", "transport"]);
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
    // The section is marked unresolved because a revision request still targets
    // it, not because a confirmation checkpoint exists.
    expect(plan.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetAgent: "accommodation",
          reason: expect.stringContaining("over budget"),
        }),
      ]),
    );
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
