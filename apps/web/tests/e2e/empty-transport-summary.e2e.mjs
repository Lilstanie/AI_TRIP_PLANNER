import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(
  process.cwd(),
  "output/e2e/empty-transport-summary",
  process.env.RUN_ID ?? "latest",
);
mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (ok, message) => {
  checks.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
async function plan(name, extra = {}) {
  const brief = {
    tripId: `empty-transport-${name}`,
    userId: "transport-test",
    destination: "Sydney",
    dates: ["2026-11-07", "2026-11-10"],
    groupSize: 2,
    budgetTotal: 5000,
    ...extra,
  };
  const response = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify({
      tripId: brief.tripId,
      mode: "plan",
      message: "Update budget to AUD 5000",
      brief,
    }),
  });
  const body = await response.text();
  writeFileSync(`${OUT}/${name}.ndjson`, body);
  const terminal = body
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .at(-1);
  check(response.ok && terminal?.type === "complete", `${name}: budget-sheet public API completes`);
  return terminal?.response;
}
const local = await plan("no-origin");
const transport = local?.plan.sections.find((section) => section.id === "transport")?.proposal;
check(transport?.items.length === 0, "no departure city produces no transport items");
check(
  !/0 transport|option\(s\)|Sydney\s*[↔→]\s*Sydney|known estimate AUD 0/.test(local?.reply ?? ""),
  "budget reply has no empty transport counter or invented self-route",
);
check(
  !/0 transport|option\(s\)|Sydney\s*[↔→]\s*Sydney|known estimate AUD 0/.test(
    transport?.summary ?? "",
  ),
  "empty transport proposal has no raw counter or self-route",
);
const travel = await plan("with-origin", { origin: "Melbourne" });
const travelTransport = travel?.plan.sections.find(
  (section) => section.id === "transport",
)?.proposal;
check(
  (travelTransport?.items.length ?? 0) > 0 &&
    (travelTransport?.items.reduce((total, item) => total + (item.estCost ?? 0), 0) ?? 0) > 0,
  "a supplied departure city retains travel and fares",
);
writeFileSync(`${OUT}/summary.json`, JSON.stringify({ checks }, null, 2));
if (checks.some((result) => !result.ok)) process.exitCode = 1;
