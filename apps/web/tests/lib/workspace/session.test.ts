import { describe, expect, it } from "vitest";
import type { AgentProgressEvent, TripPlan } from "@trip/shared";
import { draftFor, type Draft } from "@/lib/workspace/workspace";
import {
  idleSession,
  PREPARING,
  requestTurn,
  session,
  type SessionState,
  type Task,
} from "@/lib/workspace/session";
import { plan } from "@/tests/fixtures/workspace";

/*
 * How a planning turn can go wrong for the traveller, written before the code:
 *
 * - a plan applied but the "changed by" figure compares against the wrong total, or the old
 *   selected stop, drawn routes or field errors survive onto the new plan;
 * - a turn that needs more information, asks a question or answers a fare question replaces or
 *   clears the open trip, drops the traveller's selected stop, or loses what was understood;
 * - a question about an open trip overwrites the preferences form with the question's guesses;
 * - a failed turn clears the traveller's unsent text, or forgets what to retry;
 * - a cancelled turn shows a failure, or leaves the workspace busy;
 * - a retry after a failure keeps the old error on screen, or the next success keeps a retry button;
 * - the transport reports an aborted request as a failure, or a server error as a plan.
 *
 * How a change the traveller makes by hand can go wrong, written before the code:
 *
 * - an applied edit leaves "changed by" comparing against an older total, or against nothing;
 * - an applied edit drops the selected stop or the routes it was edited beside;
 * - opening another chat or trip keeps the old trip's selected stop, routes, error, retry, question
 *   card or busy state, or mixes the old chat's messages and unsent text into the new one.
 */

const task: Task = { kind: "chat", request: { tripId: "test-trip", message: "Plan Sydney" } };
const progress: AgentProgressEvent = { type: "agent_started", agent: "itinerary", round: 1 };
const replanned: TripPlan = { ...plan, estTotal: 450 };

function openTrip(): SessionState {
  return {
    ...idleSession({
      plan,
      draft: draftFor(plan.brief),
      messages: [{ role: "user", text: "Plan Sydney" }],
      input: "",
    }),
    busy: true,
    selectedActivity: "stop-1",
    mapRoutes: [{ mode: "walk" } as never],
    errors: { destination: "Required" },
  };
}

function blankTrip(draft: Partial<Draft> = {}): SessionState {
  return {
    ...idleSession({
      draft: { ...draftFor(plan.brief), destination: "", ...draft },
      messages: [],
      input: "",
    }),
    busy: true,
  };
}

describe("session after a planning turn", () => {
  it("applies a plan: records the previous total and clears the selected stop, routes and field errors", () => {
    const next = session(openTrip(), {
      kind: "planned",
      plan: replanned,
      reply: "Updated",
      transcript: [PREPARING, progress],
      at: 1,
    });
    expect(next.plan?.estTotal).toBe(450);
    expect(next.previousTotal).toBe(200);
    expect(next.selectedActivity).toBeUndefined();
    expect(next.mapRoutes).toEqual([]);
    expect(next.errors).toEqual({});
    expect(next.busy).toBe(false);
    expect(next.activity).toEqual([]);
    expect(next.messages.at(-1)).toEqual({
      role: "agent",
      text: "Updated",
      at: 1,
      activity: [PREPARING, progress],
    });
  });

  it("applies a first plan with no previous total, and gives its stops ids", () => {
    const next = session(blankTrip(), {
      kind: "planned",
      plan,
      reply: "Here it is",
      transcript: [PREPARING],
      at: 1,
    });
    expect(next.previousTotal).toBeUndefined();
    const items = next.plan?.sections[0]?.proposal?.items ?? [];
    expect(items[0]?.id).toBeTruthy();
    // A reply with no progress carries no Think fold.
    expect(next.messages.at(-1)).toEqual({ role: "agent", text: "Here it is", at: 1 });
  });

  it("needs information: asks in the chat, keeps what was understood, and plans nothing", () => {
    const next = session(blankTrip({ start: "" }), {
      kind: "needsInfo",
      question: "When do you leave?",
      known: { destination: "Hobart" },
      transcript: [],
      at: 2,
    });
    expect(next.plan).toBeUndefined();
    expect(next.draft.destination).toBe("Hobart");
    expect(next.messages.at(-1)?.text).toBe("When do you leave?");
    expect(next.ask).toBeUndefined();
    expect(next.busy).toBe(false);
  });

  it("planner asked a question about the open trip: shows the card and leaves the trip and form alone", () => {
    const before = openTrip();
    const next = session(before, {
      kind: "asked",
      key: "ask-1",
      questions: [{ id: "pace", question: "Slow or fast?" }],
      known: { destination: "Hobart" },
      plan,
      reply: "",
      transcript: [],
      at: 3,
    });
    expect(next.plan).toBe(before.plan);
    expect(next.draft).toBe(before.draft);
    expect(next.selectedActivity).toBe("stop-1");
    // An empty reply falls back to the question itself.
    expect(next.messages.at(-1)?.text).toBe("Slow or fast?");
    expect(next.ask).toEqual({
      key: "ask-1",
      questions: [{ id: "pace", question: "Slow or fast?" }],
      known: { destination: "Hobart" },
      plan,
    });
  });

  it("planner asked a question with no trip yet: keeps what it understood in the form", () => {
    const next = session(blankTrip(), {
      kind: "asked",
      key: "ask-2",
      questions: [{ id: "who", question: "Who is going?" }],
      known: { destination: "Hobart" },
      reply: "A few things first.",
      transcript: [],
      at: 4,
    });
    expect(next.draft.destination).toBe("Hobart");
    expect(next.messages.at(-1)?.text).toBe("A few things first.");
    expect(next.ask?.plan).toBeUndefined();
  });

  it("a fare answer goes in the chat with its fares and leaves the open trip as it was", () => {
    const before = openTrip();
    const flights = {
      type: "flight_answer" as const,
      reply: "Fares from Sydney",
      from: "SYD",
      to: "HBA",
      depart: "2026-10-01",
      passengers: 1,
      options: [],
    };
    const next = session(before, { kind: "answered", flights, transcript: [], at: 5 });
    expect(next.plan).toBe(before.plan);
    expect(next.previousTotal).toBe(before.previousTotal);
    expect(next.messages.at(-1)).toEqual({
      role: "agent",
      text: "Fares from Sydney",
      flights,
      at: 5,
    });
  });

  it("failed: shows the error, keeps the unsent text and the trip, and offers a retry", () => {
    const before = { ...openTrip(), input: "half-typed" };
    const next = session(before, { kind: "failed", message: "Planning failed.", task });
    expect(next.error).toBe("Planning failed.");
    expect(next.retry).toBe(task);
    expect(next.input).toBe("half-typed");
    expect(next.plan).toBe(before.plan);
    expect(next.messages).toBe(before.messages);
    expect(next.busy).toBe(false);
  });

  it("cancelled: stops being busy and reports nothing", () => {
    const before = openTrip();
    const next = session(before, { kind: "cancelled" });
    expect(next).toEqual({ ...before, busy: false });
  });

  it("a retry after a failure clears the error, and its success leaves no retry behind", () => {
    const failed = session(openTrip(), { kind: "failed", message: "Planning failed.", task });
    const retrying = session(failed, { kind: "started" });
    expect(retrying.error).toBe("");
    expect(retrying.retry).toBeUndefined();
    expect(retrying.busy).toBe(true);
    const done = session(retrying, {
      kind: "planned",
      plan: replanned,
      reply: "Updated",
      transcript: [],
      at: 6,
    });
    expect(done.error).toBe("");
    expect(done.retry).toBeUndefined();
    expect(done.plan?.estTotal).toBe(450);
  });

  it("a submitted brief clears the field errors; a chat message leaves them showing", () => {
    const message = { role: "user" as const, text: "Hi" };
    expect(session(openTrip(), { kind: "sent", message, brief: true }).errors).toEqual({});
    const chatted = session(openTrip(), { kind: "sent", message });
    expect(chatted.errors).toEqual({ destination: "Required" });
    expect(chatted.messages.at(-1)).toBe(message);
  });

  it("a new turn drops an unanswered question card", () => {
    const asked = { ...openTrip(), ask: { key: "a", questions: [], known: {} } };
    expect(session(asked, { kind: "started" }).ask).toBeUndefined();
  });
});

describe("requestTurn", () => {
  const frames = (...lines: unknown[]) =>
    new Response(lines.map((line) => JSON.stringify(line)).join("\n"));

  it("returns an applied plan with the turn's progress", async () => {
    const seen: AgentProgressEvent[] = [];
    const outcome = await requestTurn(
      task,
      async () => frames(progress, { type: "complete", response: { plan, reply: "Done" } }),
      { signal: new AbortController().signal, onProgress: (event) => seen.push(event) },
    );
    expect(outcome).toMatchObject({ kind: "planned", plan, reply: "Done" });
    expect(outcome.kind === "planned" && outcome.transcript).toEqual([PREPARING, progress]);
    expect(seen).toEqual([progress]);
  });

  it("returns needs information, a question and a fare answer as outcomes, not failures", async () => {
    const signal = new AbortController().signal;
    const send = (line: unknown) => () => Promise.resolve(frames(line));
    const outcomes = await Promise.all([
      requestTurn(task, send({ type: "needs_info", question: "When?", known: {} }), { signal }),
      requestTurn(
        task,
        send({ type: "ask_user", questions: [{ id: "q", question: "Who?" }], known: {} }),
        { signal },
      ),
      requestTurn(
        task,
        send({
          type: "flight_answer",
          reply: "Fares",
          from: "SYD",
          to: "HBA",
          depart: "2026-10-01",
          passengers: 1,
          options: [],
        }),
        { signal },
      ),
    ]);
    expect(outcomes.map((outcome) => outcome.kind)).toEqual(["needsInfo", "asked", "answered"]);
  });

  it("returns a server error as a failure carrying the task to retry", async () => {
    const outcome = await requestTurn(
      task,
      async () => new Response(JSON.stringify({ error: "Planner is down." }), { status: 503 }),
      { signal: new AbortController().signal },
    );
    expect(outcome).toEqual({ kind: "failed", message: "Planner is down.", task });
  });

  it("returns an aborted request as cancelled, not as a failure", async () => {
    const controller = new AbortController();
    const pending = requestTurn(
      task,
      (signal) =>
        new Promise<Response>((_, reject) =>
          signal.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          ),
        ),
      { signal: controller.signal },
    );
    controller.abort();
    expect(await pending).toEqual({ kind: "cancelled" });
  });
});

describe("session after a change made by hand", () => {
  it("an applied edit records the total it replaced, and keeps the selected stop and routes", () => {
    const before = { ...openTrip(), busy: false, previousTotal: 100 };
    const next = session(before, { kind: "edited", plan: replanned });
    expect(next.plan?.estTotal).toBe(450);
    expect(next.previousTotal).toBe(200);
    expect(next.selectedActivity).toBe("stop-1");
    expect(next.mapRoutes).toEqual(before.mapRoutes);
  });

  it("opening another chat or trip shows only what was saved with it", () => {
    const before = {
      ...openTrip(),
      input: "half typed",
      error: "Planning failed.",
      retry: task,
      ask: { key: "a", questions: [], known: {} },
      activity: [PREPARING],
    };
    const blank = { draft: draftFor(plan.brief), messages: [], input: "" };
    expect(session(before, { kind: "opened", saved: blank })).toEqual({
      plan: undefined,
      previousTotal: undefined,
      draft: draftFor(plan.brief),
      messages: [],
      input: "",
      busy: false,
      activity: [],
      error: "",
      errors: {},
      retry: undefined,
      ask: undefined,
      selectedActivity: undefined,
      mapRoutes: [],
    });
    const saved = { ...blank, plan: replanned, previousTotal: 300, input: "next" };
    const reopened = session(before, { kind: "opened", saved });
    expect(reopened.plan).toBe(replanned);
    expect(reopened.previousTotal).toBe(300);
    expect(reopened.input).toBe("next");
  });
});
