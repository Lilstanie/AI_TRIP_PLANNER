import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it, afterAll, vi } from "vitest";
import { ChatTurn, type ChatRequest, type TripBrief } from "@trip/shared";
import { AskUserError, runTripChat } from "../src/chat";
import { brief, itinerary, memoryStore, scriptedModel, tools } from "./chat-test-fixtures";

type Entry = "plan" | "offline-known" | "offline-submitted" | "model-replan" | "model-finish";
const entries: Entry[] = [
  "plan",
  "offline-known",
  "offline-submitted",
  "model-replan",
  "model-finish",
];
const evidence: unknown[] = [];
const clock = () => new Date("2026-10-17T12:00:00Z");
const update = (candidate: TripBrief) => ({
  name: "update_trip_brief",
  id: "update",
  args: {
    destination: candidate.destination,
    startDate: candidate.dates[0],
    endDate: candidate.dates[1],
    groupSize: candidate.groupSize,
    budgetAmount: candidate.budgetTotal,
    budgetCurrency: "AUD",
  },
});
async function execute(
  entry: Entry,
  candidate: TripBrief,
  message = "Plan this trip",
  history: ChatTurn[] = [],
  known?: ChatRequest["known"],
) {
  const { mem, turns } = memoryStore(history);
  const specialist = {
    ...itinerary,
    invoke: vi.fn((...args: Parameters<typeof itinerary.invoke>) => itinerary.invoke(...args)),
  };
  const model = entry.startsWith("model")
    ? scriptedModel(
        [update(candidate)],
        ...(entry === "model-replan" ? [[{ name: "replan_trip", args: {}, id: "plan" }]] : []),
      )
    : undefined;
  const request: ChatRequest = {
    tripId: candidate.tripId,
    message,
    ...(entry === "plan" ? { mode: "plan", brief: candidate } : {}),
    ...(entry === "offline-submitted" ? { brief: candidate } : {}),
    ...(entry === "offline-known" ? { known: candidate } : {}),
    ...(known ? { known } : {}),
  };
  try {
    const response = await runTripChat(request, {
      model,
      extractor: asyncExtractor(candidate),
      specialists: [specialist],
      tools,
      mem,
      clock,
    });
    evidence.push({ entry, request, response, turns });
    return { type: "ready", response, turns };
  } catch (error) {
    evidence.push({
      entry,
      request,
      error: error instanceof AskUserError ? error.askUser : String(error),
      turns,
    });
    return {
      type: error instanceof AskUserError ? error.askUser.questions[0]?.id : "incomplete",
      error,
      turns,
      dispatches: specialist.invoke.mock.calls.length,
    };
  }
}
const asyncExtractor = (candidate: TripBrief) => ({ extract: async () => candidate });
afterAll(() => {
  const out = "../../output/e2e/brief-intake";
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/matrix.json`, JSON.stringify(evidence, null, 2));
});

describe.each(entries)("brief intake via %s", (entry) => {
  const candidate = { ...brief, tripId: `intake-${entry}` };
  it("plans a complete future brief, including a model that only records facts", async () => {
    const result = await execute(entry, candidate);
    expect(result.type).toBe("ready");
    expect(result.response?.plan.brief.dates).toEqual(candidate.dates);
  });
  it("clarifies a conjunction destination before dispatch", async () => {
    const result = await execute(entry, { ...candidate, destination: "Trinidad and Tobago" });
    expect(result.type).toBe("destination-conjunction");
    expect(result.dispatches).toBe(0);
  });
  it("accepts the confirmed full place name", async () => {
    const full = { ...candidate, destination: "Trinidad and Tobago" };
    expect((await execute(entry, full, "Trinidad and Tobago", [], full)).type).toBe("ready");
  });
  it("asks for past dates", async () => {
    expect((await execute(entry, { ...candidate, dates: ["2025-01-10", "2025-01-11"] })).type).toBe(
      "past-trip-dates",
    );
  });
  it("confirms the same historical dates after a rewritten typed prompt", async () => {
    const historical = { ...candidate, dates: ["2025-01-10", "2025-01-11"] as [string, string] };
    const prompt = ChatTurn.parse({
      role: "assistant",
      content: "These dates need your approval. 文案可以改。",
      pendingBriefConfirmation: { kind: "historical_dates", dates: historical.dates },
    });
    expect(
      (await execute(entry, historical, "Dates: Confirm historical trip", [prompt])).type,
    ).toBe("ready");
  });
  it("does not reuse a confirmation for different dates", async () => {
    const prompt = ChatTurn.parse({
      role: "assistant",
      content: "Confirm?",
      pendingBriefConfirmation: { kind: "historical_dates", dates: ["2025-01-08", "2025-01-09"] },
    });
    expect(
      (
        await execute(
          entry,
          { ...candidate, dates: ["2025-01-10", "2025-01-11"] },
          "Confirm historical trip",
          [prompt],
        )
      ).type,
    ).toBe("past-trip-dates");
  });
  it.each(["yes", "确认", "Plan it"])("rejects a vague answer: %s", async (message) => {
    const historical = { ...candidate, dates: ["2025-01-10", "2025-01-11"] as [string, string] };
    const prompt = ChatTurn.parse({
      role: "assistant",
      content: "Confirm?",
      pendingBriefConfirmation: { kind: "historical_dates", dates: historical.dates },
    });
    const result = await execute(entry, historical, message, [prompt]);
    expect(result.type).toBe("past-trip-dates");
    expect(result.dispatches).toBe(0);
    expect(result.turns.at(-1)?.pendingBriefConfirmation).toEqual({
      kind: "historical_dates",
      dates: historical.dates,
      destination: historical.destination,
    });
  });
  it("rejects legacy prompt wording without typed state", async () => {
    const historical = { ...candidate, dates: ["2025-01-10", "2025-01-11"] as [string, string] };
    const prompt = ChatTurn.parse({
      role: "assistant",
      content: "Reply “Confirm historical trip” to keep these dates: 2025-01-10 to 2025-01-11.",
    });
    const result = await execute(entry, historical, "Confirm historical trip", [prompt]);
    expect(result.type).toBe("past-trip-dates");
    expect(result.dispatches).toBe(0);
  });
  it("does not confirm without a prompt", async () => {
    const result = await execute(
      entry,
      { ...candidate, dates: ["2025-01-10", "2025-01-11"] },
      "Confirm historical trip",
    );
    expect(result.type).toBe("past-trip-dates");
    expect(result.dispatches).toBe(0);
  });
  it("ignores a superseded prompt", async () => {
    const historical = { ...candidate, dates: ["2025-01-10", "2025-01-11"] as [string, string] };
    const history = [
      ChatTurn.parse({
        role: "assistant",
        content: "Confirm?",
        pendingBriefConfirmation: { kind: "historical_dates", dates: historical.dates },
      }),
      ChatTurn.parse({ role: "assistant", content: "Something else" }),
    ];
    expect((await execute(entry, historical, "Confirm historical trip", history)).type).toBe(
      "past-trip-dates",
    );
  });
  it.each([
    ["2027-02-30", "2027-03-01"],
    ["2027-06-22", "2027-06-15"],
  ])("blocks invalid dates %s to %s", async (start, end) => {
    const result = await execute(entry, { ...candidate, dates: [start, end] });
    expect(result.type).toBe("incomplete");
    expect(result.dispatches).toBe(0);
  });
});
