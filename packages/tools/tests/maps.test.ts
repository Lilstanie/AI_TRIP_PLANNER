import { afterEach, describe, expect, it, vi } from "vitest";
import { places, route, routeOptions } from "../src/maps";

const q = {
  from: "Tokyo",
  to: "Kyoto",
  date: "2026-10-03",
  departureTime: "2026-10-03T00:00:00.000Z",
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("B route provider boundaries", () => {
  function google(data: unknown) {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "test-only");
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
    vi.stubGlobal("fetch", fetcher);
    return fetcher;
  }
  it.each([undefined, "", "oops", "0s", "-1s", "Infinitys"])(
    "rejects invalid Google duration %s instead of inventing a minute",
    async (duration) => {
      google({ routes: [{ duration }] });
      await expect(route(q)).rejects.toThrow("invalid route duration");
    },
  );
  it("retains fractional seconds and marks a missing fare", async () => {
    const fetcher = google({ routes: [{ duration: "60.5s" }] });
    expect(await route(q)).toEqual([
      expect.objectContaining({
        durationMin: 2,
        price: 0,
        note: expect.stringContaining("fare unavailable"),
      }),
    ]);
    expect(fetcher.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("distinguishes no route from a provider error", async () => {
    google({ routes: [] });
    expect(await route(q)).toEqual([]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(route(q)).rejects.toThrow("503");
  });
  it("resolves a date-only departure in the origin timezone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T00:00:00.000Z"));
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "test-only");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [{ location: { latitude: -33.86, longitude: 151.2 } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "OK", timeZoneId: "Australia/Sydney" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ routes: [{ duration: "60s" }] }) });
    vi.stubGlobal("fetch", fetcher);

    await route({ from: "Sydney", to: "Sydney CBD", date: "2026-10-05", localTime: "09:00" });
    expect(String(fetcher.mock.calls[0]![0])).toContain(
      "places.googleapis.com/v1/places:searchText",
    );
    expect(String(fetcher.mock.calls[1]![0])).toContain(
      "maps.googleapis.com/maps/api/timezone/json",
    );
    expect(String(fetcher.mock.calls[2]![1].body)).toContain("2026-10-04T22:00:00.000Z");
  });
  it("rejects missing and out-of-window transit departure times", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T00:00:00.000Z"));
    const fetcher = google({ routes: [{ duration: "60s" }] });
    await expect(route({ from: "Tokyo", to: "Kyoto" })).rejects.toThrow("requires a date");
    await expect(
      route({ from: "Tokyo", to: "Kyoto", departureTime: "2026-01-01T00:00:00.000Z" }),
    ).rejects.toThrow("outside");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["2026-02-30T09:00:00Z", "2026-10-03T09:00:00+15:00"])(
    "rejects invalid RFC 3339 departure instant %s",
    async (departureTime) => {
      const fetcher = google({ routes: [{ duration: "60s" }] });
      await expect(route({ from: "Tokyo", to: "Kyoto", departureTime })).rejects.toThrow(
        "ISO instant",
      );
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("rejects a nonexistent local departure during a DST gap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T00:00:00.000Z"));
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "test-only");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [{ location: { latitude: -33.86, longitude: 151.2 } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "OK", timeZoneId: "Australia/Sydney" }),
      });
    vi.stubGlobal("fetch", fetcher);

    await expect(
      route({ from: "Sydney", to: "Sydney CBD", date: "2026-10-04", localTime: "02:30" }),
    ).rejects.toThrow("ambiguous or nonexistent");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects invalid geocoding before requesting a road route", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "osm");
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: "NaN", lon: "140", display_name: "invalid" }],
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(route(q)).rejects.toThrow("coordinates");
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes("route/v1"))).toBe(true);
  });
  it("labels OSRM as driving-only rather than free transit", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "osm");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes("route/v1")
            ? { routes: [{ duration: 60, distance: 500 }] }
            : [{ lat: "35", lon: "139", display_name: "city" }],
      })),
    );
    expect((await route(q))[0]!.note).toContain("driving-only");
  });
});

describe("B resolves a named place to the one the plan means", () => {
  const tokyo = { latitude: 35.68, longitude: 139.69 };
  const kyoto = { latitude: 35.01, longitude: 135.77 };

  function google(data: unknown) {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "test-only");
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
    vi.stubGlobal("fetch", fetcher);
    return fetcher;
  }
  const bodyOf = (fetcher: ReturnType<typeof vi.fn>, call = 0) =>
    JSON.parse(String(fetcher.mock.calls[call]![1].body));

  it("sends coordinates rather than a name Google would resolve against the world", async () => {
    const fetcher = google({ routes: [{ duration: "60s" }] });

    await route({ ...q, fromLocation: tokyo, toLocation: kyoto });

    expect(bodyOf(fetcher)).toMatchObject({
      origin: { location: { latLng: tokyo } },
      destination: { location: { latLng: kyoto } },
    });
  });

  it("still addresses a point by name when the caller has no coordinates for it", async () => {
    const fetcher = google({ routes: [{ duration: "60s" }] });

    await route({ ...q, fromLocation: tokyo });

    expect(bodyOf(fetcher)).toMatchObject({
      origin: { location: { latLng: tokyo } },
      destination: { address: "Kyoto" },
    });
  });

  it("treats an out-of-range coordinate as absent instead of routing from nowhere", async () => {
    const fetcher = google({ routes: [{ duration: "60s" }] });

    await route({ ...q, fromLocation: { latitude: 91, longitude: 0 } });

    expect(bodyOf(fetcher)).toMatchObject({ origin: { address: "Tokyo" } });
  });

  it("compares ways to travel between the same two points", async () => {
    const fetcher = google({ routes: [{ duration: "60s" }] });

    await routeOptions({ ...q, fromLocation: tokyo, toLocation: kyoto });

    for (const call of fetcher.mock.calls) {
      expect(JSON.parse(String(call[1].body))).toMatchObject({
        origin: { location: { latLng: tokyo } },
        destination: { location: { latLng: kyoto } },
      });
    }
  });

  it("skips the place search for the origin time zone when the origin is already resolved", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T00:00:00.000Z"));
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "test-only");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "OK", timeZoneId: "Asia/Tokyo" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ routes: [{ duration: "60s" }] }) });
    vi.stubGlobal("fetch", fetcher);

    await route({ from: "Tokyo", to: "Kyoto", date: "2026-10-05", localTime: "09:00", fromLocation: tokyo });

    // The name lookup is gone; the time zone is asked for the point itself.
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0]![0])).toContain("maps/api/timezone/json");
    expect(String(fetcher.mock.calls[0]![0])).toContain("location=35.68%2C139.69");
  });

  it("skips geocoding on the road provider too", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "osm");
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ routes: [{ duration: 60, distance: 500 }] }) });
    vi.stubGlobal("fetch", fetcher);

    await route({ ...q, fromLocation: tokyo, toLocation: kyoto });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]![0])).toContain("139.69,35.68;135.77,35.01");
  });
});

describe("B places provider boundaries", () => {
  function google(data: unknown) {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "test-only");
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
    vi.stubGlobal("fetch", fetcher);
    return fetcher;
  }

  it("queries Google Places by category and destination, and returns grounded results", async () => {
    const fetcher = google({
      places: [
        { displayName: { text: "Sensoji Temple" }, types: ["tourist_attraction"], rating: 4.5 },
      ],
    });

    const results = await places({ near: "Tokyo", category: "temple" });

    expect(results).toEqual([
      { name: "Sensoji Temple", category: "temple", rating: 4.5 },
    ]);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      textQuery: "temple in Tokyo",
      pageSize: 5,
    });
  });

  it("falls back to Google's own place type when no category was requested", async () => {
    google({ places: [{ displayName: { text: "Ichiran Ramen" }, types: ["restaurant"] }] });

    const [result] = await places({ near: "Tokyo" });

    expect(result).toEqual({ name: "Ichiran Ramen", category: "restaurant" });
  });

  it("asks for the place's own site and reports it, or nothing when Google has none", async () => {
    const fetcher = google({
      places: [
        {
          displayName: { text: "Sensoji Temple" },
          types: ["tourist_attraction"],
          websiteUri: "https://www.senso-ji.jp/",
        },
        { displayName: { text: "Nakamise Street" }, types: ["tourist_attraction"] },
      ],
    });

    const results = await places({ near: "Tokyo" });

    expect(results.map((place) => place.website)).toEqual(["https://www.senso-ji.jp/", undefined]);
    const [, init] = fetcher.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      "x-goog-fieldmask": expect.stringContaining("places.websiteUri"),
    });
  });

  it("drops candidates with no usable name instead of returning a blank card", async () => {
    google({ places: [{ types: ["restaurant"] }, { displayName: { text: "  " } }] });

    expect(await places({ near: "Tokyo" })).toEqual([]);
  });

  it("passes Google's 1.0-5.0 rating through unconverted (unlike accommodation's 0-10 scale)", async () => {
    google({ places: [{ displayName: { text: "A" }, rating: 4.9 }] });

    expect((await places({ near: "Tokyo" }))[0]!.rating).toBe(4.9);
  });

  it("propagates an upstream failure instead of returning an empty list silently", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "test-only");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(places({ near: "Tokyo" })).rejects.toThrow("429");
  });

  it("requires MAPS_API_KEY before calling Google", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");

    await expect(places({ near: "Tokyo" })).rejects.toThrow("MAPS_API_KEY");
  });
});
