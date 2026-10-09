import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleNotConfiguredError, GoogleRequestError } from "@/lib/integrations/google";
import { createMapProvider, routeLeg } from "@/lib/map-provider";
import type { MapProvider } from "@/lib/map-provider/types";

/*
 * Failure modes, written before the fallback provider (CLAUDE.md, spec #270):
 *
 * Classification — Google counts as unavailable, and OSM is asked, when:
 *  1. there is no server key (Google is never called);
 *  2. Google answers 401 or 403 (access denied, API disabled, billing off);
 *  3. Google answers 400 with reason API_KEY_INVALID (a bad key is a 400 on Places, not a 403);
 *  4. Google answers 429 (quota exhausted);
 *  5. Google answers 5xx;
 *  6. the request times out or the network fails;
 *  7. the Time Zone API answers 200 with REQUEST_DENIED or OVER_QUERY_LIMIT.
 * Google is NOT unavailable, and OSM must not be asked, when:
 *  8. a search answers with no places (an empty result is an answer);
 *  9. Google answers 400 for another reason, or 404 (an unknown place);
 * 10. the place or photo id belongs to Google and only Google can read it.
 * Outcome:
 * 11. when OSM cannot answer either, the Google failure is what the caller sees (unchanged notices);
 * 12. a route that neither provider can answer is `unavailable` with Google's notice, never a throw.
 * Cool-down:
 * 13. after an access or quota failure Google is skipped until the cool-down ends;
 * 14. once it ends, Google is tried again;
 * 15. a 5xx or timeout does not start a cool-down.
 * Selection:
 * 16. `google` never falls back, even on 403;
 * 17. `osm` never calls Google;
 * 18. ids scoped `osm:` go to OSM, never to Google.
 * Mock switch:
 * 19. MOCK_GOOGLE_MAPS=unavailable in mock data mode fails Google without calling it;
 * 20. the switch is ignored in live data mode.
 */

const place = { id: "osm:node/1", displayName: { text: "Fushimi Inari" } };

/** A stand-in for the OSM provider, which later tickets implement: it always answers. */
function answeringOsm() {
  return {
    searchPlaces: vi.fn(async () => ({ value: [place], source: "osm" as const })),
    placeDetails: vi.fn(async () => ({ value: place, source: "osm" as const })),
    placePhoto: vi.fn(async () => ({
      value: "https://upload.wikimedia.org/x.jpg",
      source: "osm" as const,
    })),
    route: vi.fn(
      async (from: string, to: string, _departure: string, mode: "WALK" | "TRANSIT" | "DRIVE") => ({
        from,
        to,
        mode,
        status: "ok" as const,
        durationMin: 12,
        source: "osm" as const,
      }),
    ),
    routeFromLocation: vi.fn(async (_origin, to: string, mode: "WALK" | "TRANSIT") => ({
      from: "current-location",
      to,
      mode,
      status: "ok" as const,
      durationMin: 9,
      source: "osm" as const,
    })),
    timeZone: vi.fn(async () => ({ value: "Asia/Tokyo", source: "osm" as const })),
  } satisfies MapProvider;
}

let fetcher: ReturnType<typeof vi.fn>;
function googleAnswers(respond: (url: string) => Response | Promise<Response>) {
  fetcher = vi.fn(async (url: string | URL | Request) => respond(String(url)));
  vi.stubGlobal("fetch", fetcher);
}
const googleError = (status: number, reason?: string) =>
  Response.json(
    { error: { code: status, status: "X", ...(reason ? { details: [{ reason }] } : {}) } },
    { status },
  );

let clock = 0;
const now = () => clock;
const COOLDOWN = 300_000;

function fallback(osm: MapProvider = answeringOsm()) {
  return createMapProvider({ setting: "google-with-fallback", osm, cooldownMs: COOLDOWN, now });
}

beforeEach(() => {
  clock = 1_000_000;
  process.env.MAPS_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete process.env.MAPS_API_KEY;
});

describe("which Google failures fall back to OSM", () => {
  it("answers from OSM when the server has no Google key, without calling Google", async () => {
    delete process.env.MAPS_API_KEY;
    googleAnswers(() => Response.json({ places: [] }));

    const result = await fallback().searchPlaces({ text: "Fushimi Inari", destination: "Kyoto" });

    expect(result).toEqual({ value: [place], source: "osm" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ["access denied or API disabled", () => googleError(403)],
    ["an unauthorised key", () => googleError(401)],
    ["an invalid key", () => googleError(400, "API_KEY_INVALID")],
    ["an exhausted quota", () => googleError(429)],
    ["a Google server error", () => googleError(503)],
  ])("answers from OSM on %s", async (_label, response) => {
    googleAnswers(response);

    const result = await fallback().searchPlaces({ text: "Fushimi Inari" });

    expect(result.source).toBe("osm");
  });

  it("answers from OSM when Google times out", async () => {
    googleAnswers(() => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });

    expect((await fallback().searchPlaces({ text: "Fushimi Inari" })).source).toBe("osm");
  });

  it("answers from OSM when the network to Google fails", async () => {
    googleAnswers(() => {
      throw new TypeError("fetch failed");
    });

    expect((await fallback().searchPlaces({ text: "Fushimi Inari" })).source).toBe("osm");
  });

  it("answers the time zone from OSM when the Time Zone API denies the request", async () => {
    googleAnswers(() => Response.json({ status: "REQUEST_DENIED" }));
    const tokyo = { id: "g1", location: { latitude: 35.68, longitude: 139.76 } };

    expect(await fallback().timeZone(tokyo, "2026-11-01")).toEqual({
      value: "Asia/Tokyo",
      source: "osm",
    });
  });

  it("routes a leg through OSM when Google Routes is over quota", async () => {
    googleAnswers(() => googleError(429));

    const leg = await fallback().route("g1", "g2", "2026-11-01T09:00:00Z", "WALK");

    expect(leg).toMatchObject({ status: "ok", durationMin: 12, source: "osm" });
  });
});

describe("what does not fall back", () => {
  it("returns Google's empty search as an answer and never asks OSM", async () => {
    const osm = answeringOsm();
    googleAnswers(() => Response.json({}));

    const result = await fallback(osm).searchPlaces({ text: "zzzz" });

    expect(result).toEqual({ value: [], source: "google" });
    expect(osm.searchPlaces).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown place", () => googleError(404)],
    ["a bad request", () => googleError(400)],
  ])("passes Google's answer for %s through without asking OSM", async (_label, response) => {
    const osm = answeringOsm();
    googleAnswers(response);

    await expect(fallback(osm).placeDetails("g-gone")).rejects.toBeInstanceOf(GoogleRequestError);
    expect(osm.placeDetails).not.toHaveBeenCalled();
  });

  it("labels a Google answer as Google's", async () => {
    googleAnswers(() => Response.json({ places: [{ id: "g1" }] }));

    expect(await fallback().searchPlaces({ text: "temple" })).toEqual({
      value: [{ id: "g1" }],
      source: "google",
    });
  });
});

describe("when no provider can answer", () => {
  const silentOsm = (): MapProvider => {
    const fail = async () => {
      throw new Error("OSM is not available");
    };
    return {
      searchPlaces: fail,
      placeDetails: fail,
      placePhoto: fail,
      route: fail,
      routeFromLocation: fail,
      timeZone: fail,
    };
  };

  it("reports Google's own failure, so the traveller's notice is unchanged", async () => {
    delete process.env.MAPS_API_KEY;

    await expect(fallback(silentOsm()).searchPlaces({ text: "temple" })).rejects.toBeInstanceOf(
      GoogleNotConfiguredError,
    );
  });

  it("reports a leg as unavailable with Google's notice rather than throwing", async () => {
    googleAnswers(() => googleError(403));

    const leg = await routeLeg(fallback(silentOsm()), "g1", "g2", "2026-11-01T09:00:00Z", "WALK");

    expect(leg).toMatchObject({
      status: "unavailable",
      notice: { key: "Google request failed ({status}). Please retry.", params: { status: 403 } },
    });
  });
});

describe("cool-down after an access or quota failure", () => {
  it("skips Google until the cool-down ends, then tries it again", async () => {
    let status = 403;
    googleAnswers(() =>
      status === 200 ? Response.json({ places: [{ id: "g1" }] }) : googleError(status),
    );
    const provider = fallback();

    await provider.searchPlaces({ text: "temple" });
    status = 200;
    clock += COOLDOWN - 1;
    const during = await provider.searchPlaces({ text: "temple" });
    clock += 1;
    const after = await provider.searchPlaces({ text: "temple" });

    expect(during.source).toBe("osm");
    expect(after.source).toBe("google");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("starts no cool-down after a Google server error", async () => {
    let status = 500;
    googleAnswers(() =>
      status === 200 ? Response.json({ places: [{ id: "g1" }] }) : googleError(status),
    );
    const provider = fallback();

    await provider.searchPlaces({ text: "temple" });
    status = 200;

    expect((await provider.searchPlaces({ text: "temple" })).source).toBe("google");
  });
});

describe("forcing one provider", () => {
  it("never falls back when the setting is google, even on access denied", async () => {
    const osm = answeringOsm();
    googleAnswers(() => googleError(403));
    const provider = createMapProvider({ setting: "google", osm, cooldownMs: COOLDOWN, now });

    await expect(provider.searchPlaces({ text: "temple" })).rejects.toBeInstanceOf(
      GoogleRequestError,
    );
    expect(osm.searchPlaces).not.toHaveBeenCalled();
  });

  it("never calls Google when the setting is osm", async () => {
    googleAnswers(() => Response.json({ places: [{ id: "g1" }] }));
    const provider = createMapProvider({
      setting: "osm",
      osm: answeringOsm(),
      cooldownMs: COOLDOWN,
      now,
    });

    expect((await provider.searchPlaces({ text: "temple" })).source).toBe("osm");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends an OSM-scoped place to OSM even while Google works", async () => {
    googleAnswers(() => Response.json({ id: "g1" }));

    expect((await fallback().placeDetails("osm:node/1")).source).toBe("osm");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("mock switch for a simulated Google outage", () => {
  it("fails Google without calling it in mock data mode", async () => {
    vi.stubEnv("MOCK_GOOGLE_MAPS", "unavailable");
    googleAnswers(() => Response.json({ places: [{ id: "g1" }] }));
    const provider = createMapProvider({
      setting: "google-with-fallback",
      osm: answeringOsm(),
      cooldownMs: COOLDOWN,
      now,
      dataMode: "mock",
    });

    expect((await provider.searchPlaces({ text: "temple" })).source).toBe("osm");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("ignores the switch in live data mode", async () => {
    vi.stubEnv("MOCK_GOOGLE_MAPS", "unavailable");
    googleAnswers(() => Response.json({ places: [{ id: "g1" }] }));
    const provider = createMapProvider({
      setting: "google-with-fallback",
      osm: answeringOsm(),
      cooldownMs: COOLDOWN,
      now,
      dataMode: "live",
    });

    expect((await provider.searchPlaces({ text: "temple" })).source).toBe("google");
  });
});
