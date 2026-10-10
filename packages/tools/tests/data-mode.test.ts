import { describe, it, expect, vi } from "vitest";
import {
  configuredDataMode,
  dataMode,
  mockEnabled,
  parseDataMode,
  runWithDataMode,
} from "../src/data-mode";

describe("data mode", () => {
  it('defaults to mock, and only the exact string "false" opts into live', () => {
    vi.stubEnv("USE_MOCK_TOOLS", "");
    expect(configuredDataMode()).toBe("mock");
    vi.stubEnv("USE_MOCK_TOOLS", "true");
    expect(configuredDataMode()).toBe("mock");

    vi.stubEnv("USE_MOCK_TOOLS", "False");
    expect(configuredDataMode()).toBe("mock");
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    expect(configuredDataMode()).toBe("live");
    vi.unstubAllEnvs();
  });

  it("lets a request override the environment default", () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    expect(dataMode()).toBe("live");
    runWithDataMode("mock", () => {
      expect(dataMode()).toBe("mock");
      expect(mockEnabled()).toBe(true);
    });

    expect(dataMode()).toBe("live");
    vi.unstubAllEnvs();
  });

  it("falls back to the environment when a request states no preference", () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    runWithDataMode(undefined, () => expect(dataMode()).toBe("live"));
    vi.unstubAllEnvs();
  });

  it("keeps concurrent requests from seeing each other's mode", async () => {
    const observed: string[] = [];
    const run = (mode: "mock" | "live", delay: number) =>
      runWithDataMode(mode, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        observed.push(`${mode}:${dataMode()}`);
      });

    await Promise.all([run("live", 20), run("mock", 5)]);
    expect(observed).toEqual(["mock:mock", "live:live"]);
  });

  it("ignores wire values that are not a known mode", () => {
    expect(parseDataMode("live")).toBe("live");
    expect(parseDataMode("mock")).toBe("mock");
    for (const bad of ["LIVE", "", "true", null, undefined])
      expect(parseDataMode(bad)).toBeUndefined();
  });
});
