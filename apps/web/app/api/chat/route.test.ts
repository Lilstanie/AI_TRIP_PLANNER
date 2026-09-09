import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatStreamEvent, type ChatResponse, type ChatRunProgress } from "@trip/shared";

const { runTripChatMock } = vi.hoisted(() => ({ runTripChatMock: vi.fn() }));

vi.mock("@trip/orchestrator", () => ({ runTripChat: runTripChatMock }));

import { POST } from "./route";

const result: ChatResponse = {
  reply: "Updated.",
  plan: {
    tripId: "trip-1",
    planVersion: "plan-1234",
    brief: {
      tripId: "trip-1",
      userId: "user-1",
      destination: "Sydney",
      dates: ["2026-10-01", "2026-10-04"],
      groupSize: 1,
      budgetTotal: 1000,
    },
    round: 1,
    budgetTotal: 1000,
    estTotal: 500,
    overrunPct: -50,
    sections: [],
    hitl: [],
  },
};

function request(accept?: string) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(accept ? { accept } : {}),
    },
    body: JSON.stringify({ tripId: "trip-1", message: "Keep the current trip." }),
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => runTripChatMock.mockReset());

  it("keeps the existing JSON response compatible", async () => {
    runTripChatMock.mockResolvedValue(result);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
  });

  it("streams parseable progress lines followed by the existing ChatResponse", async () => {
    runTripChatMock.mockImplementation(
      async (_input: unknown, options?: { onProgress?: (progress: ChatRunProgress) => void }) => {
        options?.onProgress?.({
          phase: "running",
          message: "Day plan is preparing its proposal",
          agent: {
            id: "itinerary",
            label: "Day plan",
            status: "running",
            model: "DeepSeek · deepseek-v4-flash",
            usage: null,
          },
        });
        return result;
      },
    );

    const response = await POST(request("application/x-ndjson"));
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => ChatStreamEvent.parse(JSON.parse(line)));
    expect(events[0]).toMatchObject({ type: "progress", progress: { phase: "running" } });
    expect(events.at(-1)).toEqual({ type: "result", response: result });
  });
});
