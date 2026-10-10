import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localInstant } from "@/lib/integrations/google";
import { osmMapProvider } from "@/lib/map-provider/osm";

type Call = { url: string; headers: Record<string, string> };
let calls: Call[];
function osrmAnswers(respond: (url: string) => Response | Promise<Response>) {
  calls = [];
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    return respond(String(url));
  });
}
const ok = (seconds: number, distance = 1200) =>
  Response.json({
    code: "Ok",
    routes: [{ duration: seconds, distance, geometry: "_p~iF~ps|U_ulLnnqC" }],
  });

const kyotoStation = { latitude: 34.9858, longitude: 135.7588 };
const toji = { latitude: 34.9805, longitude: 135.7478 };
const hints = { fromLocation: kyotoStation, toLocation: toji };
const DEPART = "2026-11-01T00:00:00Z";

beforeEach(() => {
  vi.stubEnv("OSRM_BASE_URL", "https://car.example/osrm");
  vi.stubEnv("OSRM_FOOT_BASE_URL", "https://foot.example/routed-foot");
  vi.stubEnv("OSM_USER_AGENT", "trip-planner-test (team@example.org)");
});
afterEach(() => vi.unstubAllEnvs());

describe("legs from OSRM", () => {
  it("walks on the foot server and drives on the car server, lon,lat order", async () => {
    const fetch = osrmAnswers(() => ok(600));
    const osm = osmMapProvider({ fetch });

    await osm.route("osm:node/1", "osm:node/2", DEPART, "WALK", hints);
    await osm.route("osm:node/1", "osm:node/2", DEPART, "DRIVE", hints);

    expect(calls[0]!.url).toMatch(
      /^https:\/\/foot\.example\/routed-foot\/route\/v1\/foot\/135\.7588,34\.9858;135\.7478,34\.9805\?/,
    );
    expect(calls[1]!.url).toMatch(
      /^https:\/\/car\.example\/osrm\/route\/v1\/driving\/135\.7588,34\.9858;135\.7478,34\.9805\?/,
    );
  });

  it("answers a leg in whole minutes, rounded up, labelled as OSRM's", async () => {
    const osm = osmMapProvider({ fetch: osrmAnswers(() => ok(601.2, 1830)) });

    expect(await osm.route("osm:node/1", "osm:node/2", DEPART, "WALK", hints)).toMatchObject({
      from: "osm:node/1",
      to: "osm:node/2",
      mode: "WALK",
      status: "ok",
      durationMin: 11,
      distanceMeters: 1830,
      polyline: "_p~iF~ps|U_ulLnnqC",
      source: "osrm",
    });
  });

  it("never answers a leg of zero minutes", async () => {
    const osm = osmMapProvider({ fetch: osrmAnswers(() => ok(4)) });

    expect((await osm.route("a", "b", DEPART, "DRIVE", hints)).durationMin).toBe(1);
  });

  it("reports OSRM's NoRoute as no route, not as an outage", async () => {
    const osm = osmMapProvider({
      fetch: osrmAnswers(() =>
        Response.json({ code: "NoRoute", message: "Impossible route" }, { status: 400 }),
      ),
    });

    expect(await osm.route("a", "b", DEPART, "WALK", hints)).toMatchObject({
      status: "no_route",
      source: "osrm",
    });
  });

  it.each([
    ["a server error", () => new Response("down", { status: 503 })],
    ["an answer without a duration", () => Response.json({ code: "Ok", routes: [{}] })],
    [
      "a timeout",
      () => {
        throw new DOMException("timed out", "TimeoutError");
      },
    ],
    [
      "a network failure",
      () => {
        throw new TypeError("fetch failed");
      },
    ],
  ])("fails as unavailable on %s, without a guessed time", async (_label, respond) => {
    const osm = osmMapProvider({ fetch: osrmAnswers(respond) });

    await expect(osm.route("a", "b", DEPART, "WALK", hints)).rejects.toMatchObject({
      name: "MapProviderUnavailableError",
    });
  });

  it("fails as unavailable when it cannot locate a place, and asks nobody", async () => {
    const fetch = osrmAnswers(() => ok(600));
    const osm = osmMapProvider({ fetch });

    await expect(osm.route("ChIJgoogle1", "ChIJgoogle2", DEPART, "WALK")).rejects.toMatchObject({
      name: "MapProviderUnavailableError",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never interprets an OSRM response as public transport", async () => {
    const fetch = osrmAnswers(() => ok(600));
    const osm = osmMapProvider({ fetch });

    await expect(osm.route("a", "b", DEPART, "TRANSIT", hints)).rejects.toMatchObject({
      name: "MapProviderUnavailableError",
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toContain("/api/v6/plan");
  });

  it("answers the same leg again from its cache, but asks again after a failure", async () => {
    let fail = true;
    const fetch = osrmAnswers(() => (fail ? new Response("down", { status: 502 }) : ok(600)));
    const osm = osmMapProvider({ fetch });

    await expect(osm.route("a", "b", DEPART, "WALK", hints)).rejects.toThrow();
    fail = false;
    await osm.route("a", "b", DEPART, "WALK", hints);
    await osm.route("a", "b", DEPART, "WALK", hints);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("sends the contact user agent", async () => {
    const osm = osmMapProvider({ fetch: osrmAnswers(() => ok(600)) });

    await osm.route("a", "b", DEPART, "WALK", hints);

    expect(calls[0]!.headers["user-agent"]).toBe("trip-planner-test (team@example.org)");
  });
});

describe("route from my location", () => {
  it("walks from the traveller's position to an OSM place by OSRM foot", async () => {
    const fetch = osrmAnswers(() => ok(540, 700));
    const osm = osmMapProvider({ fetch, locate: async () => toji });

    const route = await osm.routeFromLocation(kyotoStation, "osm:node/2", "WALK");

    expect(route).toMatchObject({
      from: "current-location",
      to: "osm:node/2",
      mode: "WALK",
      status: "ok",
      durationMin: 9,
      distanceMeters: 700,
      source: "osrm",
    });
    expect(calls[0]!.url).toContain("/route/v1/foot/135.7588,34.9858;135.7478,34.9805");
  });
});

describe("time zone without Google", () => {
  const at = (latitude: number, longitude: number) => ({
    id: "osm:node/1",
    location: { latitude, longitude },
  });

  it("refuses a place with no coordinates rather than assuming UTC", async () => {
    await expect(osmMapProvider().timeZone({ id: "x" }, "2026-11-01")).rejects.toThrow(
      "This place has no verified coordinates.",
    );
  });

  it("gives Apia, just across the date line, its own UTC+13 zone", async () => {
    const { value, source } = await osmMapProvider().timeZone(at(-13.833, -171.767), "2026-11-01");

    expect(source).toBe("osm");
    expect(value).toBe("Pacific/Apia");

    expect(localInstant("2026-11-01", "09:00", value)).toBe("2026-10-31T20:00:00.000Z");
  });

  it("keeps Sydney's local times right across the October DST change", async () => {
    const { value } = await osmMapProvider().timeZone(at(-33.8688, 151.2093), "2026-10-04");

    expect(value).toBe("Australia/Sydney");

    expect(localInstant("2026-10-03", "09:00", value)).toBe("2026-10-02T23:00:00.000Z");
    expect(localInstant("2026-10-05", "09:00", value)).toBe("2026-10-04T22:00:00.000Z");

    expect(() => localInstant("2026-10-04", "02:30", value)).toThrow(/daylight saving/);
  });
});
