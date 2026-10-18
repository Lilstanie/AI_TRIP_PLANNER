import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/e2e/planning-tip-scope", process.env.RUN_ID ?? "latest");
mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (ok, message) => {
  checks.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const brief = {
  tripId: "planning-tip-scope",
  userId: "planning-tip-scope",
  destination: "Sydney",
  dates: ["2026-12-01", "2027-12-31"],
  groupSize: 2,
  budgetTotal: 3000,
};
async function plan(name, submitted) {
  const response = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify({
      tripId: submitted.tripId,
      mode: "plan",
      message: "Update trip",
      brief: submitted,
    }),
  });
  const body = await response.text();
  writeFileSync(`${OUT}/${name}.ndjson`, body);
  const terminal = body
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .at(-1);
  check(response.ok && terminal?.type === "complete", `${name}: public chat completes`);
  return terminal?.response;
}
const long = await plan("cross-year", brief);
const guide = long?.plan.sections.find((section) => section.id === "destination-guide")?.proposal;
for (const kind of ["weather-packing", "safety", "entry-health"]) {
  const detail = guide?.items.find((item) => item.kind === kind)?.detail ?? "";
  check(
    /December 2026 only/.test(detail) && /December 2027/.test(detail),
    `${kind}: first-month scope and remaining trip are explicit`,
  );
}
const short = await plan("same-month", {
  ...brief,
  tripId: "tip-same-month",
  dates: ["2026-12-01", "2026-12-04"],
  budgetTotal: 5000,
});
const shortWeather = short?.plan.sections
  .find((section) => section.id === "destination-guide")
  ?.proposal?.items.find((item) => item.kind === "weather-packing");
check(
  !/only;|remaining months/.test(shortWeather?.detail ?? ""),
  "same-month tips do not acquire cross-month scope labels",
);
writeFileSync(`${OUT}/summary.json`, JSON.stringify({ checks }, null, 2));
if (checks.some((result) => !result.ok)) process.exitCode = 1;
