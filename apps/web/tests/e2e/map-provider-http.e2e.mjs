import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const BASE = process.env.BASE_URL;
const port = Number(process.env.MAP_STUB_PORT);
if (!BASE || !port) throw new Error("Requires BASE_URL and MAP_STUB_PORT");
const calls = [],
  failures = [],
  checks = [];
const check = (ok, message) => {
  checks.push({ ok, message });
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
const place = (id = 21, lat = 35) => ({
  osm_type: "node",
  osm_id: id,
  lat: String(lat),
  lon: "135",
  name: "Station",
  display_name: "Station, Kyoto",
  type: "station",
});
const server = createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${port}`);
  calls.push({
    path: u.pathname,
    query: Object.fromEntries(u.searchParams),
    at: Date.now(),
    contact: req.headers["user-agent"],
  });
  res.setHeader("content-type", "application/json");
  if (u.pathname === "/api/") {
    if (u.searchParams.get("q") === "empty") return res.end(JSON.stringify({ features: [] }));
    if (u.searchParams.get("q") === "Kyoto")
      return res.end(
        JSON.stringify({
          features: [
            {
              geometry: { coordinates: [135, 35] },
              properties: { osm_type: "N", osm_id: 1, name: "Kyoto" },
            },
          ],
        }),
      );
    res.statusCode = 503;
    return res.end("{}");
  }
  if (u.pathname === "/search") {
    if (u.searchParams.get("q") === "broken") {
      res.statusCode = 503;
      return res.end("{}");
    }
    return res.end(JSON.stringify([place()]));
  }
  if (u.pathname === "/lookup") {
    const id = Number((u.searchParams.get("osm_ids") || "N0").slice(1));
    return res.end(
      JSON.stringify([
        {
          ...place(id, id === 99 ? 0 : 35),
          name: u.searchParams.get("accept-language") === "zh" ? "京都站" : "Kyoto Station",
        },
      ]),
    );
  }
  if (u.pathname === "/api/v6/plan") {
    const none = u.searchParams.get("toPlace").startsWith("0,");
    return res.end(
      JSON.stringify({
        itineraries: none
          ? [{ duration: 600, legs: [{ mode: "WALK" }] }]
          : [{ duration: 900, legs: [{ mode: "BUS" }] }],
      }),
    );
  }
  res.statusCode = 404;
  res.end("{}");
});
await new Promise((done) => server.listen(port, "127.0.0.1", done));
const post = async (path, data) => {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-trip-data-mode": "live" },
    body: JSON.stringify(data),
  });
  return { status: response.status, body: await response.json() };
};
try {
  const empty = await post("/api/places/search", { text: "empty" });
  check(
    empty.status === 200 &&
      empty.body.places.length === 0 &&
      !calls.some((c) => c.path === "/search"),
    "empty Photon answer does not fall back",
  );
  const found = await post("/api/places/search", {
    text: "station",
    destination: "Kyoto",
    language: "en",
  });
  check(
    found.body.source === "osm" && found.body.places[0]?.id === "osm:node/21",
    "Photon outage falls back to Nominatim",
  );
  check(
    calls.some((c) => c.path === "/api/" && c.query.bbox === "134.5,34.5,135.5,35.5"),
    "Photon search is bounded to destination",
  );
  check(
    calls.some(
      (c) => c.path === "/search" && c.query.bounded === "1" && c.query["accept-language"] === "en",
    ),
    "Nominatim keeps bounds and language",
  );

  const beforeSuggestions = calls.filter((c) => c.path === "/search").length;
  await post("/api/places/search", { text: "suggest-outage", autocomplete: true });
  await post("/api/places/search", { text: "中文建议", language: "zh", autocomplete: true });
  check(
    calls.filter((c) => c.path === "/search").length === beforeSuggestions,
    "autocomplete never falls back to Nominatim",
  );
  const concurrent = await Promise.all(
    [22, 23, 24].map((id) => post("/api/places/details", { placeId: `osm:node/${id}` })),
  );
  check(
    concurrent.every((r) => r.status === 200 && r.body.place.rating === undefined),
    "concurrent OSM details have no invented rating",
  );
  const beforeCache = calls.filter((c) => c.path === "/lookup").length;
  await post("/api/places/details", { placeId: "osm:node/22" });
  check(
    calls.filter((c) => c.path === "/lookup").length === beforeCache,
    "duplicate details use the cache",
  );

  const chinese = await post("/api/places/details", { placeId: "osm:node/25", language: "zh" });
  const english = await post("/api/places/details", { placeId: "osm:node/25", language: "en" });
  check(
    chinese.body.place?.displayName?.text === "京都站",
    "Chinese details keep the localized name",
  );
  check(
    english.body.place?.displayName?.text === "Kyoto Station",
    "details cache separates languages",
  );
  const error = await post("/api/places/search", { text: "broken" });
  check(error.status === 503, "both search providers failing is retryable unavailable");
  await post("/api/places/search", { text: "中文站", language: "zh" });
  check(
    calls.some((c) => c.query["accept-language"] === "zh"),
    "Chinese place search reaches the language-aware service",
  );
  const nominatim = calls.filter((c) => ["/search", "/lookup"].includes(c.path));
  check(
    nominatim.slice(1).every((c, i) => c.at - nominatim[i].at >= 990),
    "all Nominatim starts, including failures, are at least one second apart",
  );
  check(
    calls.every((c) => c.contact?.includes("AI-Trip-Planner")),
    "upstream requests include the project contact",
  );
  const transit = await post("/api/routes/from-location", {
    latitude: 35,
    longitude: 135,
    placeId: "osm:node/22",
    mode: "TRANSIT",
  });
  check(
    transit.body.status === "ok" &&
      transit.body.source === "transitous" &&
      transit.body.durationMin === 15,
    "real transit schema maps seconds to whole minutes",
  );
  const none = await post("/api/routes/from-location", {
    latitude: 35,
    longitude: 135,
    placeId: "osm:node/99",
    mode: "TRANSIT",
  });
  check(
    none.body.status === "no_route" && none.body.durationMin === undefined,
    "walking-only itinerary does not become transit",
  );
  for (const query of [
    "name=bad&width=400",
    "name=osm:commons/test.jpg&width=401",
    "name=places/a/photos/b&width=0",
  ]) {
    const response = await fetch(`${BASE}/api/places/photo?${query}`);
    check(response.status === 400, `invalid photo request rejected: ${query}`);
  }
} finally {
  await new Promise((done) => server.close(done));
  const out = resolve("output/e2e/map-provider-http");
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, "summary.json"), JSON.stringify({ checks, failures, calls }, null, 2));
}
if (failures.length) process.exitCode = 1;
