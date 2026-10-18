import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = process.env.PARTY_EVIDENCE ?? resolve("output/e2e/party-breakdown");
mkdirSync(out, { recursive: true });

const checks = [];
function check(ok, message) {
  checks.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
}

async function plan(name, body) {
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  writeFileSync(`${out}/${name}.ndjson`, text);
  const terminal = text.trim().split("\n").map(JSON.parse).at(-1);
  return terminal?.type === "complete" ? terminal.response.plan?.brief : undefined;
}

const stated = await plan("one-adult-one-child", {
  tripId: "party-breakdown-en",
  message:
    "Plan a 3-day trip to Sydney from 2026-12-01 to 2026-12-03 for 1 adult and 1 child aged 3, total budget AUD 3000. We are staying with friends and need no accommodation.",
});
check(Boolean(stated), "a stated breakdown completes via the public chat API");
check(
  stated?.party?.adults === 1 && stated?.party?.children === 1,
  `"1 adult and 1 child" is kept as one adult and one child (got ${JSON.stringify(stated?.party)})`,
);
check(stated?.groupSize === 2, `groupSize follows the breakdown (got ${stated?.groupSize})`);

const chinese = await plan("chinese-breakdown", {
  tripId: "party-breakdown-zh",
  message:
    "请规划 2026-12-01 到 2026-12-03 去悉尼，两位大人和一个小孩，预算 3000 澳元，住在朋友家不需要住宿。",
  interfaceLanguage: "zh",
});
check(
  chinese?.party?.adults === 2 && chinese?.party?.children === 1,
  `"两位大人和一个小孩" is kept as two adults and one child (got ${JSON.stringify(chinese?.party)})`,
);
check(
  chinese?.groupSize === 3,
  `Chinese groupSize follows the breakdown (got ${chinese?.groupSize})`,
);

const total = await plan("total-only", {
  tripId: "party-breakdown-total",
  message:
    "Plan a 3-day trip to Sydney from 2026-12-01 to 2026-12-03 for 2 people, total budget AUD 3000. We are staying with friends and need no accommodation.",
});
check(
  total?.groupSize === 2 && total?.party === undefined,
  "a bare total carries no breakdown, so the Who editor keeps its own default",
);

const replaced = await plan("total-replaces-breakdown", {
  tripId: "party-breakdown-replaced",
  message: "Actually make it 4 people.",
  known: {
    destination: "Sydney",
    dates: ["2026-12-01", "2026-12-03"],
    groupSize: 2,
    budgetTotal: 3000,
    party: { adults: 1, children: 1, infants: 0, seniors: 0, pets: 0 },
    noAccommodation: true,
  },
});
check(
  replaced?.groupSize === 4 && replaced?.party === undefined,
  `a new total drops the old breakdown (got ${replaced?.groupSize} / ${JSON.stringify(replaced?.party)})`,
);

const failed = checks.filter((entry) => !entry.ok);
writeFileSync(
  `${out}/summary.json`,
  JSON.stringify({ base, checks, failed: failed.length }, null, 2),
);
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) process.exit(1);
