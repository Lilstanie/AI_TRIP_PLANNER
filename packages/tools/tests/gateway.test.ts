import { afterEach, describe, expect, it, vi } from "vitest";
import { createToolGateway } from "../src/gateway";

afterEach(() => vi.unstubAllEnvs());

describe("createToolGateway", () => {
  it("says nothing in mock mode", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createToolGateway();
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    [{ SERPAPI_KEY: "k" }, /booking: SerpApi/],
    [{ MAPS_PROVIDER: "google", MAPS_API_KEY: "k" }, /booking: Google Places/],
    [{}, /booking: unavailable until a configured capability is called/],
  ])(
    "describes the real booking tier accurately for %j — this line went stale once before",
    (env, expected) => {
      vi.stubEnv("USE_MOCK_TOOLS", "false");
      vi.stubEnv("OSM_USER_AGENT", "test");
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      createToolGateway();

      expect(warn.mock.calls.map((call) => call[0]).join("\n")).toMatch(expected);
    },
  );

  it("warns about a missing OSM_USER_AGENT only when osm is actually selected", () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    createToolGateway();

    expect(warn.mock.calls.flat()).toContainEqual(expect.stringContaining("OSM_USER_AGENT"));
  });
});
