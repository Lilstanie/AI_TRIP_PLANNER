import { afterEach, describe, expect, it, vi } from "vitest";
import { places } from "../src/maps";

const tokyo = [
  {
    osm_type: "relation",
    osm_id: 1543125,
    lat: "35.68",
    lon: "139.76",
    boundingbox: ["35.5", "35.9", "139.5", "139.9"],
  },
];
const sights = {
  elements: [
    {
      type: "node",
      lat: 35.7148,
      lon: 139.7967,
      tags: {
        name: "浅草寺",
        "name:en": "Senso-ji",
        wikidata: "Q1",
        website: "https://www.senso-ji.jp",
      },
    },
    {
      type: "way",
      center: { lat: 35.7101, lon: 139.8107 },
      tags: { name: "東京スカイツリー", wikidata: "Q2" },
    },
    { type: "node", lat: 35.7, lon: 139.7, tags: { wikidata: "Q3" } },
  ],
};

function stub(...bodies: Array<{ status?: number; body: unknown }>) {
  vi.stubEnv("USE_MOCK_TOOLS", "false");
  vi.stubEnv("MAPS_PROVIDER", "osm");
  const fetcher = vi.fn();
  for (const { status = 200, body } of bodies)
    fetcher.mockResolvedValueOnce({ ok: status < 400, status, json: async () => body });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

const overpassQuery = (fetcher: ReturnType<typeof vi.fn>, call = 1) =>
  decodeURIComponent(
    String((fetcher.mock.calls[call]![1] as RequestInit).body).replace(/\+/g, " "),
  );

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("OSM places by category", () => {
  it("asks Overpass for tagged sights inside the city's own area, not a 'sight in Tokyo' name match", async () => {
    const fetcher = stub({ body: tokyo }, { body: sights });

    const found = await places({ near: "Tokyo", category: "sight" });

    expect(String(fetcher.mock.calls[0]![0])).toContain("nominatim");
    expect(String(fetcher.mock.calls[0]![0])).toContain("q=Tokyo");
    expect(String(fetcher.mock.calls[1]![0])).toContain("/interpreter");
    const query = overpassQuery(fetcher);
    expect(query).toContain("area(id:3601543125)");
    expect(query).toContain('"tourism"');
    expect(query).toContain('["wikidata"]');
    expect(found).toEqual([
      {
        name: "浅草寺",
        category: "sight",
        location: { latitude: 35.7148, longitude: 139.7967 },
        website: "https://www.senso-ji.jp",
      },
      {
        name: "東京スカイツリー",
        category: "sight",
        location: { latitude: 35.7101, longitude: 139.8107 },
      },
    ]);
  });

  it("finds neighbourhoods and restaurants by their own tags", async () => {
    const neighbourhoods = stub({ body: tokyo }, { body: { elements: [] } });
    await places({ near: "Tokyo", category: "neighborhood" });
    expect(overpassQuery(neighbourhoods)).toMatch(
      /"place"~"\^\(suburb\|quarter\|neighbourhood\)\$"/,
    );

    const restaurants = stub({ body: tokyo }, { body: { elements: [] } });
    await places({ near: "Tokyo", category: "restaurant" });
    expect(overpassQuery(restaurants)).toContain('"amenity"~"^(restaurant|cafe|food_court)$"');
  });

  it("searches a bounding box when the city is not an OSM area", async () => {
    const fetcher = stub(
      { body: [{ osm_type: "node", osm_id: 9, boundingbox: ["1", "2", "3", "4"] }] },
      { body: { elements: [] } },
    );

    await places({ near: "Somewhere", category: "sight" });

    expect(overpassQuery(fetcher)).toContain("(1,3,2,4)");
  });

  it("returns nothing when the city cannot be found, without asking Overpass", async () => {
    const fetcher = stub({ body: [] });

    expect(await places({ near: "Nowhere", category: "sight" })).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("propagates an Overpass failure instead of returning name matches from elsewhere", async () => {
    stub({ body: tokyo }, { status: 504, body: {} });

    await expect(places({ near: "Tokyo", category: "sight" })).rejects.toThrow("504");
  });

  it("keeps the free-text Nominatim search for a text query or an unmapped category", async () => {
    const text = stub({ body: [] });
    await places({ near: "Tokyo", category: "restaurant", textQuery: "vegan ramen in Tokyo" });
    expect(String(text.mock.calls[0]![0])).toContain("q=vegan%20ramen%20in%20Tokyo");
    expect(text).toHaveBeenCalledTimes(1);

    const other = stub({ body: [] });
    await places({ near: "Tokyo", category: "onsen" });
    expect(String(other.mock.calls[0]![0])).toContain("q=onsen%20in%20Tokyo");
    expect(other).toHaveBeenCalledTimes(1);
  });
});
