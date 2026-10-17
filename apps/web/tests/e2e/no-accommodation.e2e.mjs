import { mkdirSync, writeFileSync } from "node:fs";
const out = `output/e2e/no-accommodation/${process.env.RUN_ID ?? "latest"}`;
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name) => {
  checks.push({ ok: Boolean(ok), name });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
};
async function plan(name, extra) {
  const brief = {
    tripId: `no-stay-${name}`,
    userId: "e2e",
    destination: "Sydney",
    dates: ["2026-12-01", "2026-12-04"],
    groupSize: 2,
    budgetTotal: 5000,
    ...extra,
  };
  const response = await fetch(`${process.env.BASE_URL ?? "http://localhost:3000"}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify({ tripId: brief.tripId, mode: "plan", message: "Update trip", brief }),
  });
  const body = await response.text();
  writeFileSync(`${out}/${name}.ndjson`, body);
  const terminal = body.trim().split("\n").map(JSON.parse).at(-1);
  check(response.ok && terminal.type === "complete", `${name} completes`);
  return terminal.response.plan;
}
const normal = await plan("normal", {});
const none = await plan("none", { noAccommodation: true });
const booked = await plan("booked", { bookedStay: { name: "My own stay" } });
check(
  normal.sections.some((s) => s.id === "accommodation" && s.estCost > 0),
  "normal trip retains priced accommodation",
);
check(none.brief.noAccommodation === true, "explicit no-accommodation survives brief validation");
check(
  !none.sections.some((s) => s.id === "accommodation"),
  "no-accommodation omits the entire stay section",
);
check(
  none.estTotal === none.sections.reduce((sum, s) => sum + (s.estCost ?? 0), 0),
  "total contains only remaining sections",
);
check(
  booked.sections.some((s) => s.id === "accommodation" && s.proposal.items.length > 0),
  "booked stay remains a separate recorded stay",
);
writeFileSync(`${out}/summary.json`, JSON.stringify({ checks }, null, 2));
process.exitCode = checks.some((c) => !c.ok) ? 1 : 0;
