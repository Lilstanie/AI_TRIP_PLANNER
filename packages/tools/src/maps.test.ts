import { afterEach, describe, expect, it, vi } from "vitest";
import { route } from "./maps";

const q = { from: "Tokyo", to: "Kyoto", date: "2026-10-03" };
afterEach(() => {
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
        priceUsd: 0,
        note: expect.stringContaining("fare unavailable"),
      }),
    ]);
    expect(fetcher.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
  });
  it("distinguishes no route from a provider error", async () => {
    google({ routes: [] });
    expect(await route(q)).toEqual([]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(route(q)).rejects.toThrow("503");
  });
  it("rejects invalid geocoding before requesting a road route", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "osm");
    const fetcher = vi
      .fn()
      .mockResolvedValue({
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
