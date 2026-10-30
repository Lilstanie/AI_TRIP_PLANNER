import { afterEach, describe, expect, it, vi } from "vitest";
import { clearGeoapifyCacheForTests } from "../src/geoapify";
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
  vi.stubEnv("GEOAPIFY_API_KEY", "");
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
  clearGeoapifyCacheForTests();
  vi.restoreAllMocks();
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

  it("treats an Overpass runtime error reported with HTTP 200 as a failure, not as no places", async () => {
    stub(
      { body: tokyo },
      {
        body: {
          elements: [],
          remark: 'runtime error: Query timed out in "query" at line 1 after 21 seconds.',
        },
      },
    );

    await expect(places({ near: "Tokyo", category: "sight" })).rejects.toThrow("timed out");
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

const geoTokyo = [{ osm_type: "relation", osm_id: 1543125, lat: "35.6812", lon: "139.7671" }];
const geoSights = {
  features: [
    {
      properties: {
        name: "Meiji Jingu",
        lat: 35.6764,
        lon: 139.6993,
        datasource: { raw: { wikidata: "Q1" } },
      },
    },
    {
      properties: {
        name: "Senso-ji",
        lat: 35.7148,
        lon: 139.7967,
        website: "https://www.senso-ji.jp",
        datasource: { raw: { wikipedia: "ja:浅草寺", wikidata: "Q2" } },
      },
    },
    { properties: { lat: 35.7, lon: 139.7 } },
  ],
};

function withGeoapify(...bodies: Array<{ status?: number; body: unknown }>) {
  const fetcher = stub(...bodies);
  vi.stubEnv("GEOAPIFY_API_KEY", "test-geoapify-key");
  return fetcher;
}

describe("Geoapify places by category, with Overpass as the fallback", () => {
  it("asks Geoapify for sights within 15 km of the city centre, not the whole prefecture with its islands, and never calls Overpass", async () => {
    const fetcher = withGeoapify(
      { body: geoTokyo },
      { body: geoSights },
      { body: { features: [] } },
    );

    const found = await places({ near: "Tokyo", category: "sight" });

    const [geocodeUrl, placesUrl] = fetcher.mock.calls.map(([url]) => new URL(String(url)));
    expect(geocodeUrl!.hostname).toContain("nominatim");
    expect(geocodeUrl!.searchParams.get("q")).toBe("Tokyo");
    expect(geocodeUrl!.searchParams.get("apiKey")).toBeNull();
    expect(placesUrl!.pathname).toBe("/v2/places");
    expect(placesUrl!.searchParams.get("apiKey")).toBe("test-geoapify-key");
    expect(placesUrl!.searchParams.get("filter")).toBe("circle:139.7671,35.6812,15000");
    expect(placesUrl!.searchParams.get("bias")).toBeNull();
    expect(placesUrl!.searchParams.get("limit")).toBe("500");
    expect(placesUrl!.searchParams.get("conditions")).toBe("named");
    expect(placesUrl!.searchParams.get("categories")).toContain("tourism.sights");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(found).toEqual([
      {
        name: "Senso-ji",
        category: "sight",
        location: { latitude: 35.7148, longitude: 139.7967 },
        website: "https://www.senso-ji.jp",
      },
      {
        name: "Meiji Jingu",
        category: "sight",
        location: { latitude: 35.6764, longitude: 139.6993 },
      },
    ]);
  });

  it("ranks Wikipedia places, then Wikidata places, above the unremarked statues nearest the centre", async () => {
    withGeoapify(
      { body: geoTokyo },
      {
        body: {
          features: [
            ...Array.from({ length: 30 }, (_, index) => ({
              properties: { name: `Statue ${index}`, lat: 35.681, lon: 139.767 },
            })),
            {
              properties: {
                name: "Meiji Jingu",
                lat: 35.6764,
                lon: 139.6993,
                datasource: { raw: { wikidata: "Q1" } },
              },
            },
            {
              properties: {
                name: "Senso-ji",
                lat: 35.7148,
                lon: 139.7967,
                datasource: { raw: { wikipedia: "ja:浅草寺" } },
              },
            },
          ],
        },
      },
      { body: { features: [] } },
    );

    const found = await places({ near: "Tokyo", category: "sight" });

    expect(found.slice(0, 2).map((place) => place.name)).toEqual(["Senso-ji", "Meiji Jingu"]);
    expect(found).toHaveLength(20);
  });

  it("also asks for temples and shrines, which Geoapify files under religion rather than sights", async () => {
    const fetcher = withGeoapify(
      { body: geoTokyo },
      {
        body: {
          features: [
            {
              properties: {
                name: "Memorial",
                lat: 35.6815,
                lon: 139.767,
                datasource: { raw: { historic: "memorial", wikidata: "Q9" } },
              },
            },
          ],
        },
      },
      {
        body: {
          features: [
            {
              properties: {
                name: "金龍山 浅草寺",
                lat: 35.7148,
                lon: 139.7967,
                website: "https://www.youtube.com/@sensoji",
                datasource: {
                  raw: {
                    osm_type: "w",
                    osm_id: 173154847,
                    tourism: "attraction",
                    wikidata: "Q615183",
                    "contact:website": "https://senso-ji.jp",
                  },
                },
              },
            },
          ],
        },
      },
    );

    const found = await places({ near: "Tokyo", category: "sight" });

    const categories = fetcher.mock.calls
      .slice(1)
      .map(([url]) => new URL(String(url)).searchParams.get("categories"));
    expect(categories[0]).toContain("tourism.sights");
    expect(categories[1]).toContain("religion.place_of_worship.buddhism");
    expect(categories[1]).toContain("religion.place_of_worship.shinto");
    expect(found.map((place) => place.name)).toEqual(["金龍山 浅草寺", "Memorial"]);
    expect(found[0]!.website).toBe("https://senso-ji.jp");
  });

  it("keeps the sights when the slower temple request times out", async () => {
    withGeoapify({ body: geoTokyo }, { body: geoSights }, { status: 504, body: {} });

    const found = await places({ near: "Tokyo", category: "sight" });

    expect(found.map((place) => place.name)).toEqual(["Senso-ji", "Meiji Jingu"]);
  });

  it("falls back to Overpass only when both sight requests fail", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetcher = withGeoapify(
      { body: geoTokyo },
      { status: 504, body: {} },
      { status: 504, body: {} },
      { body: tokyo },
      { body: sights },
    );

    const found = await places({ near: "Tokyo", category: "sight" });

    expect(String(fetcher.mock.calls[4]![0])).toContain("/interpreter");
    expect(found.map((place) => place.name)).toEqual(["浅草寺", "東京スカイツリー"]);
  });

  it("asks Geoapify once when several agents want the same city's sights at the same time", async () => {
    const fetcher = withGeoapify(
      { body: geoTokyo },
      { body: geoSights },
      { body: { features: [] } },
    );

    const [first, second] = await Promise.all([
      places({ near: "Tokyo", category: "sight" }),
      places({ near: "Tokyo", category: "sight" }),
    ]);
    const third = await places({ near: "Tokyo", category: "sight" });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("asks again after a failed lookup, and never answers another city or category from memory", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetcher = withGeoapify(
      { body: geoTokyo },
      { status: 503, body: {} },
      { body: tokyo },
      { body: { elements: [] } },
      { body: geoTokyo },
      { body: geoSights },
      { body: geoTokyo },
      { body: { features: [] } },
      { body: tokyo },
      { body: { elements: [] } },
      { body: [{ osm_type: "node", osm_id: 1, lat: "34.9858", lon: "135.7588" }] },
      { body: { features: [] } },
      { body: tokyo },
      { body: { elements: [] } },
    );

    await places({ near: "Tokyo", category: "museum" });
    expect(await places({ near: "Tokyo", category: "museum" })).toHaveLength(2);
    expect(await places({ near: "Tokyo", category: "restaurant" })).toEqual([]);
    expect(await places({ near: "京都", category: "museum" })).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(14);
  });

  it("centres Kyoto on the Nominatim result, which Geoapify's city search sometimes puts in China", async () => {
    const fetcher = withGeoapify(
      { body: [{ osm_type: "node", osm_id: 1, lat: "34.9858", lon: "135.7588" }] },
      { body: geoSights },
    );

    await places({ near: "京都", category: "museum" });

    expect(String(fetcher.mock.calls[0]![0])).toContain("nominatim");
    expect(new URL(String(fetcher.mock.calls[1]![0])).searchParams.get("filter")).toBe(
      "circle:135.7588,34.9858,15000",
    );
  });

  it("skips a feature whose name is not text instead of failing the whole category", async () => {
    withGeoapify(
      { body: geoTokyo },
      {
        body: {
          features: [
            { properties: { name: { ja: "名前" }, lat: 35.7, lon: 139.7 } },
            ...geoSights.features,
          ],
        },
      },
    );

    const found = await places({ near: "Tokyo", category: "museum" });

    expect(found.map((place) => place.name)).toEqual(["Senso-ji", "Meiji Jingu"]);
  });

  it("lists each restaurant name once and the nearest first, not chains repeated at the circle's edge", async () => {
    withGeoapify(
      { body: geoTokyo },
      {
        body: {
          features: [
            { properties: { name: "Tully's Coffee", lat: 35.8, lon: 139.8 } },
            { properties: { name: "Tully's Coffee", lat: 35.68, lon: 139.77 } },
            { properties: { name: "Far Diner", lat: 35.79, lon: 139.86 } },
            { properties: { name: "Near Ramen", lat: 35.682, lon: 139.768 } },
          ],
        },
      },
    );

    const found = await places({ near: "Tokyo", category: "restaurant" });

    expect(found.map((place) => place.name)).toEqual(["Near Ramen", "Tully's Coffee", "Far Diner"]);
    expect(found[1]!.location).toEqual({ latitude: 35.68, longitude: 139.77 });
  });

  it("asks Geoapify for restaurants and museums by their own categories", async () => {
    const restaurants = withGeoapify({ body: geoTokyo }, { body: geoSights });
    await places({ near: "Tokyo", category: "restaurant" });
    expect(String(restaurants.mock.calls[1]![0])).toContain("catering.restaurant");

    const museums = withGeoapify({ body: geoTokyo }, { body: geoSights });
    await places({ near: "Tokyo", category: "museum" });
    expect(String(museums.mock.calls[1]![0])).toContain("entertainment.museum");
  });

  it("falls back to Overpass when Geoapify rejects the request", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetcher = withGeoapify(
      { body: geoTokyo },
      { status: 429, body: {} },
      { body: tokyo },
      { body: sights },
    );

    const found = await places({ near: "Tokyo", category: "museum" });

    expect(String(fetcher.mock.calls[3]![0])).toContain("/interpreter");
    expect(found.map((place) => place.name)).toEqual(["浅草寺", "東京スカイツリー"]);
    expect(String(warn.mock.calls[0]![0])).toContain("429");
    expect(String(warn.mock.calls[0]![0])).not.toContain("test-geoapify-key");
    warn.mockRestore();
  });

  it("falls back to Overpass when Geoapify cannot find the city or finds no places", async () => {
    const noCity = withGeoapify({ body: [] }, { body: tokyo }, { body: sights });
    expect(await places({ near: "Tokyo", category: "museum" })).toHaveLength(2);
    expect(String(noCity.mock.calls[2]![0])).toContain("/interpreter");

    const noPlaces = withGeoapify(
      { body: geoTokyo },
      { body: { features: [] } },
      { body: tokyo },
      { body: sights },
    );
    expect(await places({ near: "Tokyo", category: "museum" })).toHaveLength(2);
    expect(String(noPlaces.mock.calls[3]![0])).toContain("/interpreter");
  });

  it("reports both providers when Geoapify and Overpass both fail", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    withGeoapify(
      { body: geoTokyo },
      { status: 401, body: {} },
      { body: tokyo },
      { status: 502, body: {} },
    );

    await expect(places({ near: "Tokyo", category: "museum" })).rejects.toThrow(
      /401.*502|502.*401/,
    );
  });

  it("keeps neighbourhoods on Overpass, which Geoapify cannot list", async () => {
    const fetcher = withGeoapify({ body: tokyo }, { body: { elements: [] } });

    await places({ near: "Tokyo", category: "neighborhood" });

    expect(String(fetcher.mock.calls[0]![0])).toContain("nominatim");
    expect(String(fetcher.mock.calls[1]![0])).toContain("/interpreter");
  });
});

describe("OSM ids the map can look up", () => {
  it("gives Overpass places their osm:<type>/<id> place id", async () => {
    stub(
      { body: tokyo },
      {
        body: {
          elements: [
            {
              type: "way",
              id: 5,
              center: { lat: 35.71, lon: 139.8 },
              tags: { name: "A", wikidata: "Q" },
            },
            { type: "node", lat: 35.7, lon: 139.7, tags: { name: "B", wikidata: "Q" } },
          ],
        },
      },
    );

    const found = await places({ near: "Tokyo", category: "sight" });

    expect(found.map((place) => place.placeId)).toEqual(["osm:way/5", undefined]);
  });

  it("turns Geoapify's one-letter OSM types into node, way and relation ids", async () => {
    stub(
      { body: [{ lat: "35.68", lon: "139.77" }] },
      {
        body: {
          features: ["n", "w", "r", undefined].map((osm_type, index) => ({
            properties: {
              name: `P${index}`,
              lat: 35.7,
              lon: 139.7,
              datasource: { raw: { ...(osm_type ? { osm_type, osm_id: index + 1 } : {}) } },
            },
          })),
        },
      },
    );
    vi.stubEnv("GEOAPIFY_API_KEY", "test-geoapify-key");

    const found = await places({ near: "Tokyo", category: "museum" });

    expect(found.map((place) => place.placeId)).toEqual([
      "osm:node/1",
      "osm:way/2",
      "osm:relation/3",
      undefined,
    ]);
  });
});
