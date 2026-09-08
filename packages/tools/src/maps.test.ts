import { describe, expect, it } from "vitest";
import { geocode, places, route } from "./maps";

describe("deterministic maps adapter", () => {
  it("geocodes known places and anchors fictional hotels to their mock city", async () => {
    await expect(geocode({ query: "Tokyo Station" })).resolves.toMatchObject({
      id: "tokyo-station",
      coordinates: { latitude: 35.6812, longitude: 139.7671 },
    });
    await expect(
      geocode({ query: "Mock Kyoto Standard, Kyoto", near: "Tokyo & Kyoto" }),
    ).resolves.toMatchObject({
      name: "Mock Kyoto Standard",
      category: "hotel",
      coordinates: { latitude: 35.0116, longitude: 135.7681 },
    });
    await expect(geocode({ query: "A place outside the fixture set" })).resolves.toBeNull();
  });

  it("returns coordinate-bearing place candidates for the demo destinations", async () => {
    const result = await places({ near: "Tokyo & Kyoto", category: "sight" });
    expect(result).toHaveLength(4);
    expect(result.every((place) => place.id && place.coordinates)).toBe(true);
  });

  it("adds distance and GeoJSON geometry to routes", async () => {
    const [leg] = await route({ from: "Tokyo", to: "Kyoto" });
    expect(leg?.distanceKm).toBeGreaterThan(300);
    expect(leg?.geometry).toEqual([
      [139.6503, 35.6762],
      [135.7681, 35.0116],
    ]);
  });
});
