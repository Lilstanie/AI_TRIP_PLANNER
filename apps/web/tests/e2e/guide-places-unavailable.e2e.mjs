// requires-env: OVERPASS_BASE_URL, NOMINATIM_BASE_URL
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const stubUrl = new URL(process.env.OVERPASS_BASE_URL);
const out = resolve("output/e2e/guide-places-unavailable");
await mkdir(out, { recursive: true });

const upstream = [];
const stub = createServer((req) => {
  upstream.push({ method: req.method, path: req.url?.split("?")[0] });
  req.socket.destroy();
});
await new Promise((done) => stub.listen(Number(stubUrl.port), stubUrl.hostname, done));

const results = [];
const check = (condition, name) => results.push({ name, passed: Boolean(condition) });
let raw = "";
try {
  const tripId = `guide-places-unavailable-${Date.now()}`;
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": "live" },
    body: JSON.stringify({
      tripId,
      message: "Plan 4 days in Lisbon from Sydney, 2 people, budget 6000 AUD, from 2027-03-10",
      mode: "plan",
      brief: {
        tripId,
        userId: "demo-user",
        destination: "Lisbon",
        origin: "Sydney",
        dates: ["2027-03-10", "2027-03-13"],
        groupSize: 2,
        budgetTotal: 6000,
        noAccommodation: true,
      },
    }),
    signal: AbortSignal.timeout(240_000),
  });
  raw = await response.text();
  const frames = raw
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const final = frames.at(-1);
  const failed = frames.filter((frame) => frame.type === "agent_failed").map(({ agent }) => agent);
  check(failed.length === 0, `no specialist failed (${failed.join(", ") || "none"})`);
  check(final.type === "complete", `chat completes (got ${JSON.stringify(final).slice(0, 300)})`);
  check(
    upstream.some(({ path }) => /\/(search|interpreter)$/.test(path ?? "")),
    `stub received place lookups (${upstream.length} requests)`,
  );
  const sections = final.response?.plan?.sections ?? [];
  const guide = sections.find((section) => section.id === "destination-guide")?.proposal;
  check(guide, "plan holds the destination guide section");
  check(
    guide?.source?.kind === "unavailable",
    `guide source is unavailable (${guide?.source?.kind})`,
  );
  check(
    /maps/i.test(guide?.source?.label ?? ""),
    `guide source names Maps (${guide?.source?.label})`,
  );
  check(
    guide && !guide.items.some((item) => item.kind === "attraction"),
    "guide invents no attraction",
  );
  const assumptions = (guide?.assumptions ?? []).join(" ");
  check(
    /place provider unavailable/i.test(assumptions),
    "guide assumptions name the failed lookups",
  );
  check(
    guide && !assumptions.includes("Attractions come from provider candidates"),
    "guide assumptions do not claim provider candidates",
  );
  const weather = guide?.items.find((item) => item.kind === "weather-packing")?.detail ?? "";
  check(/weather unavailable/.test(weather), `weather tip is unavailable (${weather})`);
  const dining = sections.find((section) => section.id === "dining")?.proposal;
  check(
    dining?.source?.kind === "unavailable",
    `dining source is unavailable (${dining?.source?.kind})`,
  );
  check(
    /maps/i.test(dining?.source?.label ?? ""),
    `dining source names Maps (${dining?.source?.label})`,
  );
  check(
    dining && dining.items.every((item) => item.kind === "meal-budget"),
    "dining suggests no venue, only the meal budget",
  );
  for (const id of ["transport", "itinerary"])
    check(
      sections.some((section) => section.id === id),
      `plan keeps the ${id} section`,
    );
  check(
    sections.find((section) => section.id === "itinerary")?.proposal?.source?.kind ===
      "unavailable",
    "itinerary stays unavailable",
  );
} catch (error) {
  results.push({ name: "execution", passed: false, error: String(error) });
} finally {
  stub.close();
}
await writeFile(`${out}/stream.ndjson`, raw);
await writeFile(`${out}/upstream.json`, `${JSON.stringify(upstream, null, 2)}\n`);
await writeFile(`${out}/summary.json`, `${JSON.stringify({ base, results }, null, 2)}\n`);
for (const result of results)
  console.log(
    `${result.passed ? "ok" : "FAIL"} ${result.name}${result.error ? `: ${result.error}` : ""}`,
  );
if (results.some((result) => !result.passed)) process.exitCode = 1;
