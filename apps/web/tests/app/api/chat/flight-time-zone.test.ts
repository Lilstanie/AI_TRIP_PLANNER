import { afterEach, expect, it, vi } from "vitest";
import type { FlightQuery } from "@trip/orchestrator";

vi.mock("@trip/orchestrator", async (original) => ({
  ...(await original<typeof import("@trip/orchestrator")>()),
  answerFlightQuery: async (query: FlightQuery) => ({
    type: "flight_answer",
    reply: "",
    from: query.from,
    to: query.to,
    depart: query.depart,
    passengers: query.passengers,
    options: [],
  }),
  runTripChat: vi.fn(),
}));
vi.mock("@trip/services", () => ({
  tripStore: { set: vi.fn() },
  memory: { getShortTerm: vi.fn(), appendShortTerm: vi.fn() },
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@trip/tools", async (original) => ({
  ...(await original<typeof import("@trip/tools")>()),
  createToolGateway: () => ({ booking: {} }),
  parseDataMode: () => "mock",
  runWithDataMode: (_mode: unknown, fn: () => unknown) => fn(),
}));
import { POST } from "../../../../app/api/chat/route";

const post = (body: object) =>
  POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tripId: "tz",
        message: "flights from Sydney to Tokyo on Feb 28",
        ...body,
      }),
    }),
  );

afterEach(() => {
  vi.useRealTimers();
});

it("departs on the traveller's next Feb 28 when Sydney is already on 1 Mar", async () => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-02-28T21:00:00Z") });
  const response = await post({ timeZone: "Australia/Sydney" });
  const [frame] = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(frame).toMatchObject({ type: "flight_answer", depart: "2027-02-28" });
});

it("rejects an unknown time zone with 400", async () => {
  expect((await post({ timeZone: "Mars/Olympus" })).status).toBe(400);
});
