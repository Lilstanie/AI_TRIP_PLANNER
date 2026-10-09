import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GoogleRequestError,
  googleRoute,
  googleRouteFromCoordinates,
  localInstant,
  placeDetails,
  searchPlaces,
  timeZone,
  type GooglePlace,
} from "@/lib/integrations/google";

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    impl(String(url), init),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.MAPS_API_KEY;
});

/** Pin "now" so the TRANSIT date-window check doesn't drift out of range as
 * real time passes — otherwise this test starts failing on its own months
 * after being written, for a reason that has nothing to do with the code. */
function pinNow(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe("MAPS_API_KEY boundary", () => {
  it("refuses to call any Google endpoint without a configured key", async () => {
    await expect(searchPlaces("temple")).rejects.toThrow("MAPS_API_KEY");
    await expect(placeDetails("place-1")).rejects.toThrow("MAPS_API_KEY");
  });
});

describe("searchPlaces", () => {
  it("sends the New Places API text-search request and returns parsed places", async () => {
    process.env.MAPS_API_KEY = "test-key";
    const fetcher = stubFetch(() =>
      Response.json({
        places: [{ id: "p1", displayName: { text: "To-ji Temple" }, rating: 4.6 }],
      }),
    );

    const places = await searchPlaces("To-ji Temple", "Kyoto");

    expect(places).toEqual([
      expect.objectContaining({ id: "p1", displayName: { text: "To-ji Temple" }, rating: 4.6 }),
    ]);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(init?.headers).toMatchObject({
      "X-Goog-Api-Key": "test-key",
      "X-Goog-FieldMask": expect.stringContaining("places.location"),
    });
    // Destination narrows the free-text query rather than becoming a separate field.
    expect(JSON.parse(String(init?.body))).toEqual({
      textQuery: "To-ji Temple Kyoto",
      pageSize: 5,
    });
  });

  it("omits the destination suffix when none is given", async () => {
    process.env.MAPS_API_KEY = "test-key";
    const fetcher = stubFetch(() => Response.json({ places: [] }));

    expect(await searchPlaces("Eiffel Tower")).toEqual([]);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({
      textQuery: "Eiffel Tower",
      pageSize: 5,
    });
  });

  it("throws GoogleRequestError with the upstream status on a non-OK response", async () => {
    process.env.MAPS_API_KEY = "test-key";
    stubFetch(() => new Response(null, { status: 429 }));

    await expect(searchPlaces("temple")).rejects.toMatchObject({
      name: "GoogleRequestError",
      status: 429,
    });
  });
});

describe("placeDetails", () => {
  it("GETs the place by id with a field mask and no body", async () => {
    process.env.MAPS_API_KEY = "test-key";
    const fetcher = stubFetch(() => Response.json({ id: "place with spaces" }));

    await placeDetails("place with spaces");

    const [url, init] = fetcher.mock.calls[0]!;
    // The raw id must be percent-encoded into the path segment.
    expect(String(url)).toBe("https://places.googleapis.com/v1/places/place%20with%20spaces");
    expect(init?.method).toBe("GET");
  });

  it("maps a 404 to a GoogleRequestError callers can branch on", async () => {
    process.env.MAPS_API_KEY = "test-key";
    stubFetch(() => new Response(null, { status: 404 }));

    const error = await placeDetails("stale-id").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GoogleRequestError);
    expect((error as GoogleRequestError).status).toBe(404);
  });
});

describe("timeZone", () => {
  const place: GooglePlace = { id: "p1", location: { latitude: -33.86, longitude: 151.2 } };

  it("rejects a place with no verified coordinates before making a request", async () => {
    const fetcher = stubFetch(() => Response.json({}));
    await expect(timeZone({ id: "p1" }, "2026-11-01")).rejects.toThrow("no verified coordinates");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("queries the Time Zone API with the place's coordinates and a noon timestamp", async () => {
    process.env.MAPS_API_KEY = "test-key";
    const fetcher = stubFetch(() =>
      Response.json({ status: "OK", timeZoneId: "Australia/Sydney" }),
    );

    expect(await timeZone(place, "2026-11-01")).toBe("Australia/Sydney");
    const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe("https://maps.googleapis.com/maps/api/timezone/json");
    expect(url.searchParams.get("location")).toBe("-33.86,151.2");
    expect(url.searchParams.get("key")).toBe("test-key");
    // Noon UTC on the given date, not midnight — avoids landing on the wrong
    // side of a DST boundary for the timezone lookup itself.
    expect(url.searchParams.get("timestamp")).toBe(
      String(Date.parse("2026-11-01T12:00:00Z") / 1000),
    );
  });

  it.each([
    { status: "ZERO_RESULTS", timeZoneId: "Australia/Sydney" },
    { status: "OK", timeZoneId: undefined },
  ])("treats an unverifiable response ($status) as a failure", async (body) => {
    process.env.MAPS_API_KEY = "test-key";
    stubFetch(() => Response.json(body));
    await expect(timeZone(place, "2026-11-01")).rejects.toThrow("could not be verified");
  });
});

describe("localInstant", () => {
  it("resolves an unambiguous local time to the correct UTC instant", () => {
    // AEDT (UTC+11) in early November.
    expect(localInstant("2026-11-01", "09:00", "Australia/Sydney")).toBe(
      "2026-10-31T22:00:00.000Z",
    );
  });

  it("rejects a local time that never existed (spring-forward DST gap)", () => {
    // Sydney clocks jump 02:00 -> 03:00 on the first Sunday of October 2026.
    expect(() => localInstant("2026-10-04", "02:30", "Australia/Sydney")).toThrow(
      "ambiguous or nonexistent",
    );
  });

  it("rejects a local time that occurs twice (fall-back DST overlap)", () => {
    // Sydney clocks fall back 03:00 -> 02:00 on the first Sunday of April 2026,
    // so 02:30 is ambiguous rather than nonexistent — same guard, other edge.
    expect(() => localInstant("2026-04-05", "02:30", "Australia/Sydney")).toThrow(
      "ambiguous or nonexistent",
    );
  });
});

describe("googleRoute", () => {
  it("requests a route by place id and returns duration, polyline and fare", async () => {
    pinNow("2026-09-20T00:00:00Z");
    process.env.MAPS_API_KEY = "test-key";
    const fetcher = stubFetch(() =>
      Response.json({
        routes: [
          {
            duration: "725s",
            polyline: { encodedPolyline: "abc123" },
            travelAdvisory: { transitFare: { currencyCode: "USD", units: "3", nanos: 5e8 } },
          },
        ],
      }),
    );

    const result = await googleRoute("place-a", "place-b", "2026-11-01T09:00:00Z", "TRANSIT");

    expect(result).toEqual({
      from: "place-a",
      to: "place-b",
      mode: "TRANSIT",
      status: "ok",
      durationMin: 13, // ceil(725 / 60)
      polyline: "abc123",
      fare: { amount: 3.5, currency: "USD" },
    });
    const body = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
    expect(body).toMatchObject({
      origin: { placeId: "place-a" },
      destination: { placeId: "place-b" },
      travelMode: "TRANSIT",
      departureTime: "2026-11-01T09:00:00Z",
    });
  });

  it("omits departureTime for a WALK request (Routes API rejects it for non-transit modes)", async () => {
    process.env.MAPS_API_KEY = "test-key";
    const fetcher = stubFetch(() => Response.json({ routes: [{ duration: "300s" }] }));

    await googleRoute("place-a", "place-b", "2026-11-01T09:00:00Z", "WALK");

    const body = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
    expect(body).not.toHaveProperty("departureTime");
  });

  it.each([{ routes: [{ duration: "" }] }, { routes: [{ duration: "oops" }] }])(
    "degrades to status 'unavailable' instead of throwing on a bad response",
    async (data) => {
      pinNow("2026-09-20T00:00:00Z");
      process.env.MAPS_API_KEY = "test-key";
      stubFetch(() => Response.json(data));

      const result = await googleRoute("place-a", "place-b", "2026-11-01T09:00:00Z", "TRANSIT");
      expect(result).toMatchObject({ status: "unavailable", error: expect.any(String) });
    },
  );

  it("degrades to 'unavailable' when the transit date is outside Google's supported window", async () => {
    const result = await googleRoute("place-a", "place-b", "2020-01-01T00:00:00Z", "TRANSIT");
    expect(result).toMatchObject({
      status: "unavailable",
      error: expect.stringContaining("supported date window"),
    });
  });

  it("surfaces an upstream failure as 'unavailable', never as a thrown error", async () => {
    pinNow("2026-09-20T00:00:00Z");
    process.env.MAPS_API_KEY = "test-key";
    stubFetch(() => new Response(null, { status: 503 }));

    const result = await googleRoute("place-a", "place-b", "2026-11-01T09:00:00Z", "TRANSIT");
    expect(result.status).toBe("unavailable");
  });
});

describe("googleRouteFromCoordinates", () => {
  const origin = { latitude: -33.86, longitude: 151.21 };

  it("sends runtime coordinates to Google Routes and returns verified distance and time", async () => {
    process.env.MAPS_API_KEY = "test-key";
    const fetcher = stubFetch(() =>
      Response.json({ routes: [{ duration: "725s", distanceMeters: 1800 }] }),
    );

    await expect(googleRouteFromCoordinates(origin, "place-1", "WALK")).resolves.toMatchObject({
      status: "ok",
      durationMin: 13,
      distanceMeters: 1800,
    });
    const request = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
    expect(request.origin.location.latLng).toEqual(origin);
    expect(request.destination.placeId).toBe("place-1");
  });

  it("never stores the caller's coordinates beyond the single outgoing request", async () => {
    process.env.MAPS_API_KEY = "test-key";
    const fetcher = stubFetch(() => Response.json({ routes: [{ duration: "60s" }] }));

    await googleRouteFromCoordinates(origin, "place-1", "WALK");
    await googleRouteFromCoordinates({ latitude: 1, longitude: 1 }, "place-1", "WALK");

    // Two independent requests, each carrying only its own origin — nothing
    // about the first caller's location leaks into or persists across calls.
    expect(fetcher).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String(fetcher.mock.calls[1]![1]?.body));
    expect(secondBody.origin.location.latLng).toEqual({ latitude: 1, longitude: 1 });
  });

  it("degrades to 'unavailable' rather than throwing when no route comes back", async () => {
    process.env.MAPS_API_KEY = "test-key";
    stubFetch(() => Response.json({ routes: [] }));

    const result = await googleRouteFromCoordinates(origin, "place-1", "TRANSIT");
    expect(result).toMatchObject({ status: "unavailable", from: "current-location" });
  });
});
