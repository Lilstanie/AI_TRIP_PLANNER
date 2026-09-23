import { describe, expect, it, vi } from "vitest";
import { BOUNDED_RESULT_ROWS, type AgentProgressEvent, type ToolGateway } from "@trip/shared";
import { placeKind, travelKind, withProgressTools } from "../src/progress-tools";

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
        kind: "stay",
      },
    ]);
    expect(completed.resultTruncated).toBeUndefined();
  });

  it("publishes the page a provider reported, and nothing it did not", async () => {
    const sited: ToolGateway = {
      ...tools,
      maps: {
        ...tools.maps,
        places: vi.fn(async () => [
          {
            name: "Sydney Opera House",
            category: "sight",
            website: "https://www.sydneyoperahouse.com/",
          },
          { name: "Mrs Macquarie's Chair", category: "viewpoint" },
          // Not a web page: a client cannot show a site for it, so it is dropped.
          { name: "Harbour Kiosk", category: "cafe", website: "tel:+61299999999" },
        ]),
      },
    };
    const events: AgentProgressEvent[] = [];
    const instrumented = withProgressTools(sited, "itinerary", 1, (event) => events.push(event));

    await instrumented.maps.places({ near: "Sydney" });

    const completed = events[1];
    expect(completed?.type).toBe("tool_completed");
    if (completed?.type !== "tool_completed") return;
    expect(completed.resultRows?.map((row) => row.url)).toEqual([
      "https://www.sydneyoperahouse.com/",
      undefined,
      undefined,
    ]);
  });

  it("publishes a stay's details page as the row's site", async () => {
    const sited: ToolGateway = {
      ...tools,
      booking: {
        ...tools.booking,
        searchStays: vi.fn(async () => [
          {
            name: "Harbour Hotel",
            area: "The Rocks",
            pricePerNight: 210,
            rating: 8.9,
            freeCancellation: true,
            detailsUrl: "https://harbourhotel.example/rooms?checkin=2026-10-01",
          },
        ]),
      },
    };
    const events: AgentProgressEvent[] = [];
    const instrumented = withProgressTools(sited, "accommodation", 1, (event) =>
      events.push(event),
    );

    await instrumented.booking.searchStays({
      city: "Sydney",
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      guests: 2,
    });

    const completed = events[1];
    expect(completed?.type).toBe("tool_completed");
    if (completed?.type !== "tool_completed") return;
    expect(completed.resultRows?.[0]?.url).toBe(
      "https://harbourhotel.example/rooms?checkin=2026-10-01",
    );
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

  it("tags every result row with the kind a client draws its icon from", async () => {
    const withWeather: ToolGateway = {
      ...tools,
      booking: {
        ...tools.booking,
        searchFlights: vi.fn(async () => [{ carrier: "Qantas", price: 420 }]),
      },
      weather: {
        forecast: vi.fn(async () => ({
          summary: "Mild and dry",
          horizon: "seasonal" as const,
          provider: "Climate normals",
        })),
      } as unknown as ToolGateway["weather"],
    };
    const events: AgentProgressEvent[] = [];
    const instrumented = withProgressTools(withWeather, "itinerary", 1, (event) =>
      events.push(event),
    );

    await instrumented.maps.places({ near: "Sydney", category: "sight" });
    await instrumented.maps.route({ from: "Sydney", to: "Newcastle" });
    await instrumented.booking.searchFlights({
      from: "SYD",
      to: "MEL",
      depart: "2026-10-01",
      passengers: 1,
    });
    await instrumented.weather!.forecast({
      location: { latitude: -33.87, longitude: 151.21 },
      targetDate: "2026-10-01",
    });

    const kinds = events.flatMap((event) =>
      event.type === "tool_completed" ? (event.resultRows ?? []).map((row) => row.kind) : [],
    );
    expect(kinds).toEqual(["attraction", "transit", "flight", "weather"]);
  });
});

describe("result row kinds", () => {
  it("reads agent and provider place categories by keyword", () => {
    expect(placeKind("sight")).toBe("attraction");
    expect(placeKind("tourist_attraction")).toBe("attraction");
    expect(placeKind("restaurant")).toBe("restaurant");
    expect(placeKind("Café")).toBe("cafe");
    expect(placeKind("coffee_shop")).toBe("cafe");
    expect(placeKind("night_club")).toBe("nightlife");
    expect(placeKind("shopping_mall")).toBe("shopping");
    expect(placeKind("national_park")).toBe("nature");
    expect(placeKind("art_gallery")).toBe("museum");
    expect(placeKind("museum")).toBe("museum");
    expect(placeKind("lodging")).toBe("stay");
  });

  it("falls back to a plain place rather than guessing", () => {
    expect(placeKind("neighborhood")).toBe("place");
    expect(placeKind("")).toBe("place");
    expect(placeKind(undefined)).toBe("place");
    // A word that only contains a keyword is not that keyword.
    expect(placeKind("barbershop")).toBe("place");
  });

  it("reads a journey by how it is made", () => {
    expect(travelKind("drive")).toBe("drive");
    expect(travelKind("car")).toBe("drive");
    for (const mode of ["transit", "bus", "train", "tram", "ferry"])
      expect(travelKind(mode)).toBe("transit");
    expect(travelKind("walk")).toBe("walk");
    expect(travelKind("flight")).toBe("flight");
    expect(travelKind("hovercraft")).toBe("route");
  });
});
