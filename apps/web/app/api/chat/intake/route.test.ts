import { describe, expect, it, vi } from "vitest";

const { runTripIntakeMock } = vi.hoisted(() => ({ runTripIntakeMock: vi.fn() }));
vi.mock("@trip/orchestrator", () => ({ runTripIntake: runTripIntakeMock }));

import { POST } from "./route";

describe("POST /api/chat/intake", () => {
  it("returns the intake agent decision without requiring a plan", async () => {
    runTripIntakeMock.mockResolvedValue({
      reply: "What dates would you like to travel?",
      draft: { tripId: "trip-1", destination: "Sydney" },
      ready: false,
      plan: null,
    });
    const response = await POST(
      new Request("http://localhost/api/chat/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tripId: "trip-1", message: "Sydney" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ready: false, plan: null });
  });
});
