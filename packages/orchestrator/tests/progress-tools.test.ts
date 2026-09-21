import { describe, expect, it, vi } from "vitest";
import { BOUNDED_RESULT_ROWS, type AgentProgressEvent, type ToolGateway } from "@trip/shared";
import { withProgressTools } from "../src/progress-tools";

const tools: ToolGateway = {
  maps: {
    places: vi.fn(async () => [{ name: "Opera House", category: "sight", rating: 9.1 }]),
    route: vi.fn(async () => [{ mode: "train" as const, durationMin: 95, price: 12.5 }]),
  },
  booking: {
    searchStays: vi.fn(async () => [
      {
        name: "Harbour Hotel",
        area: "The Rocks",
        pricePerNight: 210,
        rating: 8.9,
        freeCancellation: true,
      },
    ]),
    searchFlights: vi.fn(async () => []),
  },
};

function collect() {
  const events: AgentProgressEvent[] = [];
  const instrumented = withProgressTools(tools, "itinerary", 1, (event) => events.push(event));
  return { events, instrumented };
}

describe("progress tool instrumentation", () => {
  it("emits a started and completed event around a real gateway call", async () => {
    const { events, instrumented } = collect();

    await instrumented.maps.places({ near: "Sydney", category: "sight" });

    expect(tools.maps.places).toHaveBeenCalledWith({ near: "Sydney", category: "sight" });
    expect(events).toEqual([
      expect.objectContaining({
        type: "tool_started",
        tool: "maps.places",
        label: "Search places",
        summary: "sight near Sydney",
        args: { near: "Sydney", category: "sight" },
      }),
      expect.objectContaining({
        type: "tool_completed",
        tool: "maps.places",
        resultSummary: "1 place result",
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

  it("publishes the result's own rows so a reader can open them", async () => {
    const { events, instrumented } = collect();

    await instrumented.booking.searchStays({
      city: "Sydney",
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      guests: 2,
    });

    const completed = events[1];
    expect(completed?.type).toBe("tool_completed");
    if (completed?.type !== "tool_completed") return;
    expect(completed.resultSummary).toBe("1 stay option");
    expect(completed.resultRows).toEqual([
      {
        label: "Harbour Hotel",
        detail: "The Rocks · AUD 210.00/night · 8.9/10 · Free cancellation",
      },
    ]);
    expect(completed.resultTruncated).toBeUndefined();
  });

  it("bounds a wide result and says so", async () => {
    const wide: ToolGateway = {
      ...tools,
      maps: {
        ...tools.maps,
        places: vi.fn(async () =>
          Array.from({ length: BOUNDED_RESULT_ROWS + 5 }, (_value, index) => ({
            name: `Place ${index}`,
            category: "sight",
          })),
        ),
      },
    };
    const events: AgentProgressEvent[] = [];
    const instrumented = withProgressTools(wide, "itinerary", 1, (event) => events.push(event));

    await instrumented.maps.places({ near: "Sydney" });

    const completed = events[1];
    expect(completed?.type).toBe("tool_completed");
    if (completed?.type !== "tool_completed") return;
    expect(completed.resultCount).toBe(BOUNDED_RESULT_ROWS + 5);
    expect(completed.resultRows).toHaveLength(BOUNDED_RESULT_ROWS);
    expect(completed.resultTruncated).toBe(true);
  });

  it("reports a failed call without leaking the provider error", async () => {
    const failing: ToolGateway = {
      ...tools,
      maps: {
        ...tools.maps,
        places: vi.fn(async () => {
          throw new Error("api key sk-secret rejected");
        }),
      },
    };
    const events: AgentProgressEvent[] = [];
    const instrumented = withProgressTools(failing, "itinerary", 1, (event) => events.push(event));

    await expect(instrumented.maps.places({ near: "Sydney" })).rejects.toThrow("sk-secret");

    const failed = events.at(-1);
    expect(failed?.type).toBe("tool_failed");
    if (failed?.type !== "tool_failed") return;
    expect(failed.error).not.toContain("sk-secret");
  });
});
