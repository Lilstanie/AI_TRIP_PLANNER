import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("explicit location lookup", () => {
  async function setup(address: Record<string, string>) {
    vi.resetModules();
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ address }) });
    vi.stubGlobal("fetch", fetcher);
    return { ...(await import("../src/reverse-address")), fetcher };
  }
  it("rounds coordinates, maps town fields and reuses cached lookups", async () => {
    const { reverseAddress, fetcher } = await setup({
      town: "Glebe",
      state: "NSW",
      country: "Australia",
    });
    const result = await reverseAddress(-33.868812, 151.209312, "en");
    expect(result).toEqual({ suburb: "", city: "Glebe", state: "NSW", country: "Australia" });
    expect(String(fetcher.mock.calls[0]![0])).toContain("lat=-33.869&lon=151.209");
    await reverseAddress(-33.868812, 151.209312, "en");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects a different immediate lookup rather than exceeding the public rate", async () => {
    const { reverseAddress, fetcher } = await setup({ city: "Sydney", country: "Australia" });
    await reverseAddress(-33.86, 151.2, "en");
    await expect(reverseAddress(-33.87, 151.21, "en")).rejects.toThrow("rate_limit");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not invent a city when provider data is incomplete", async () => {
    const { reverseAddress } = await setup({ country: "Australia" });
    await expect(reverseAddress(-33.86, 151.2, "en")).rejects.toThrow("unavailable");
  });
});
