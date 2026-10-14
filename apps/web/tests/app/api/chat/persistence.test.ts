import { it, expect, vi, afterEach } from "vitest";
const state = vi.hoisted(() => ({ save: vi.fn(), run: vi.fn() }));
vi.mock("@trip/orchestrator", () => ({
  AskUserError: class extends Error {},
  IncompleteBriefError: class extends Error {},
  answerFlightQuery: vi.fn(),
  parseFlightQuery: () => undefined,
  runTripChat: state.run,
}));
vi.mock("@trip/services", () => ({ tripStore: { set: state.save } }));
vi.mock("@trip/tools", () => ({
  createToolGateway: vi.fn(),
  parseDataMode: () => "mock",
  runWithDataMode: (_mode: any, fn: any) => fn(),
}));
import { POST } from "../../../../app/api/chat/route";
const plan = {
  tripId: "triage",
  brief: {
    tripId: "triage",
    userId: "local",
    destination: "Sydney",
    dates: ["2026-10-20", "2026-10-23"],
    groupSize: 2,
    budgetTotal: 1200,
  },
  round: 1,
  budgetTotal: 1200,
  estTotal: 0,
  overrunPct: -100,
  sections: [],
  conflicts: [],
};
const request = () =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tripId: "triage", message: "plan a trip" }),
  });
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("delivers the completed plan when persistence rejects", async () => {
  state.run.mockResolvedValue({ reply: "finished plan", plan });
  state.save.mockRejectedValue(new Error("injected save failure"));
  const response = await POST(request());
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((s) => JSON.parse(s));
  expect(events.map((e) => e.type)).toEqual(["complete"]);
  expect(events[0].response.plan).toEqual(plan);
});
it("delivers completion before a pending save and bounds the stream lifetime", async () => {
  vi.useFakeTimers();
  state.run.mockResolvedValue({ reply: "finished plan", plan });
  state.save.mockImplementation(() => new Promise(() => {}));
  const response = await POST(request());
  const reader = response.body!.getReader();
  const first = await Promise.race([
    reader.read(),
    vi.advanceTimersByTimeAsync(6000).then(() => {
      throw new Error("Completion withheld by persistence");
    }),
  ]);
  expect(new TextDecoder().decode(first.value)).toContain('"type":"complete"');
  await vi.advanceTimersByTimeAsync(6000);
  expect((await reader.read()).done).toBe(true);
  vi.useRealTimers();
});

it("delivers completion with a successfully persisted copy", async () => {
  state.run.mockResolvedValue({ reply: "finished plan", plan });
  state.save.mockResolvedValue(undefined);
  const response = await POST(request());
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(events.map((event) => event.type)).toEqual(["complete"]);
  expect(events[0].response.plan).toEqual(plan);
  expect(state.save).toHaveBeenLastCalledWith(plan, { signal: expect.any(AbortSignal) });
});
