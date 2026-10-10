import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const calls = [],
  checks = [];
const check = (ok, message) => {
  checks.push({ ok, message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
async function post(path, body) {
  const response = await fetch(`${process.env.BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  calls.push({ path, status: response.status, value });
  return value;
}
const search = await post("/api/places/search", { text: "To-ji Temple", destination: "Kyoto" });
const id = search.places?.[0]?.id;
check(
  search.source === "google" && id?.startsWith("mock-google-"),
  "healthy mock search stays Google",
);
const detail = await post("/api/places/details", { placeId: id });
check(
  detail.source === "google" && detail.place?.id === id && !detail.place?.osmUri,
  "healthy mock details keep Google provenance",
);
for (const mode of ["WALK", "TRANSIT"]) {
  const route = await post("/api/routes/from-location", {
    latitude: 34.9858,
    longitude: 135.7588,
    placeId: id,
    mode,
  });
  check(
    route.status === "ok" &&
      route.source === "google" &&
      route.simulated === true &&
      route.durationMin > 0,
    `healthy mock ${mode} route uses fixtures`,
  );
}
const out = resolve("output/e2e/map-provider-healthy");
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/summary.json`, JSON.stringify({ checks, calls }, null, 2));
process.exitCode = checks.some((c) => !c.ok) ? 1 : 0;
