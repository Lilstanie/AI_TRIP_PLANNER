import { describe, expect, it, vi } from "vitest";
import type { AgentProgressEvent, ToolGateway } from "@trip/shared";
import { withProgressTools } from "../src/progress-tools";

const tools: ToolGateway = {
  maps: {
    places: vi.fn(async () => [{ name: "Opera House", category: "sight" }]),
    route: vi.fn(async () => []),
  },
  booking: {
    searchStays: vi.fn(async () => []),
    searchFlights: vi.fn(async () => []),
  },
};

describe("progress tool instrumentation", () => {
  it("emits a started and completed event around a real gateway call", async () => {
    const events: AgentProgressEvent[] = [];
    const instrumented = withProgressTools(tools, "itinerary", 1, (event) => events.push(event));

    await instrumented.maps.places({ near: "Sydney", category: "sight" });

    expect(tools.maps.places).toHaveBeenCalledWith({ near: "Sydney", category: "sight" });
    expect(events).toEqual([
      expect.objectContaining({
        type: "tool_started",
        tool: "maps.places",
        label: "Search places",
        summary: "sight near Sydney",
      }),
      expect.objectContaining({
        type: "tool_completed",
        tool: "maps.places",
        resultSummary: "1 place result(s)",
        resultCount: 1,
      }),
    ]);
    const started = events[0];
    const completed = events[1];
    expect(started?.type).toBe("tool_started");
    expect(completed?.type).toBe("tool_completed");
    if (started?.type === "tool_started" && completed?.type === "tool_completed") {
      expect(started.callId).toBe(completed.callId);
    }
  });
});
