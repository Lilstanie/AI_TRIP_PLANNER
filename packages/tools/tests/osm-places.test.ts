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

const geoTokyo = { results: [{ place_id: "tokyo-id", city: "Tokyo" }] };
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
  it("asks Geoapify for sights inside the city's own boundary and never calls Overpass", async () => {
    const fetcher = withGeoapify({ body: geoTokyo }, { body: geoSights });

    const found = await places({ near: "Tokyo", category: "sight" });

    const [geocodeUrl, placesUrl] = fetcher.mock.calls.map(([url]) => new URL(String(url)));
    expect(geocodeUrl!.pathname).toBe("/v1/geocode/search");
    expect(geocodeUrl!.searchParams.get("text")).toBe("Tokyo");
    expect(geocodeUrl!.searchParams.get("type")).toBe("city");
    expect(geocodeUrl!.searchParams.get("apiKey")).toBe("test-geoapify-key");
    expect(placesUrl!.pathname).toBe("/v2/places");
    expect(placesUrl!.searchParams.get("filter")).toBe("place:tokyo-id");
    expect(placesUrl!.searchParams.get("categories")).toContain("tourism.sights");
    expect(fetcher).toHaveBeenCalledTimes(2);
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
    const fetcher = withGeoapify({ status: 429, body: {} }, { body: tokyo }, { body: sights });

    const found = await places({ near: "Tokyo", category: "sight" });

    expect(String(fetcher.mock.calls[2]![0])).toContain("/interpreter");
    expect(found.map((place) => place.name)).toEqual(["浅草寺", "東京スカイツリー"]);
    expect(String(warn.mock.calls[0]![0])).toContain("429");
    expect(String(warn.mock.calls[0]![0])).not.toContain("test-geoapify-key");
    warn.mockRestore();
  });

  it("falls back to Overpass when Geoapify cannot find the city or finds no places", async () => {
    const noCity = withGeoapify({ body: { results: [] } }, { body: tokyo }, { body: sights });
    expect(await places({ near: "Tokyo", category: "sight" })).toHaveLength(2);
    expect(String(noCity.mock.calls[2]![0])).toContain("/interpreter");

    const noPlaces = withGeoapify(
      { body: geoTokyo },
      { body: { features: [] } },
      { body: tokyo },
      { body: sights },
    );
    expect(await places({ near: "Tokyo", category: "sight" })).toHaveLength(2);
    expect(String(noPlaces.mock.calls[3]![0])).toContain("/interpreter");
  });

  it("reports both providers when Geoapify and Overpass both fail", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    withGeoapify({ status: 401, body: {} }, { body: tokyo }, { status: 502, body: {} });

    await expect(places({ near: "Tokyo", category: "sight" })).rejects.toThrow(/401.*502|502.*401/);
  });

  it("keeps neighbourhoods on Overpass, which Geoapify cannot list", async () => {
    const fetcher = withGeoapify({ body: tokyo }, { body: { elements: [] } });

    await places({ near: "Tokyo", category: "neighborhood" });

    expect(String(fetcher.mock.calls[0]![0])).toContain("nominatim");
    expect(String(fetcher.mock.calls[1]![0])).toContain("/interpreter");
  });
});
