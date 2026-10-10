import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MODE = process.env.DATA_MODE ?? "live";
const RUNS = Number(process.env.RUNS ?? 1);
const ONLY = process.env.ONLY?.split(",").map((id) => id.trim());
const RUN = `${new Date().toISOString().replace(/[:.]/g, "-")}-${MODE}`;
const OUT = resolve(process.cwd(), "output/e2e/leg-mode-choice", RUN);
mkdirSync(OUT, { recursive: true });

const TRIP = {
  destination: "Sydney",
  origin: "Melbourne",
  dates: ["2026-11-10", "2026-11-14"],
  groupSize: 2,
  budgetTotal: 6000,
};

const SCENARIOS = [
  {
    id: "train-in-brief",

    brief: { ...TRIP, legModes: [{ from: "Melbourne", to: "Sydney", mode: "train" }] },
    chosen: { from: "Melbourne", to: "Sydney", mode: "train" },

    expectPriced: true,
  },
  {
    id: "casing-and-spacing",

    brief: { ...TRIP, legModes: [{ from: "  melbourne ", to: "SYDNEY", mode: "train" }] },
    chosen: { from: "Melbourne", to: "Sydney", mode: "train" },
  },
  {
    id: "impossible-walk",

    brief: { ...TRIP, legModes: [{ from: "Melbourne", to: "Sydney", mode: "walk" }] },
    chosen: { from: "Melbourne", to: "Sydney", mode: "walk" },
    expectUnmet: true,
  },
  {
    id: "stale-choice",

    brief: { ...TRIP, legModes: [{ from: "Brisbane", to: "Cairns", mode: "bus" }] },
    chosen: undefined,
  },
  {
    id: "said-in-chat",

    brief: TRIP,
    follow: "Actually, take the train from Melbourne to Sydney instead of flying.",
    chosen: { from: "Melbourne", to: "Sydney", mode: "train" },
  },
].filter(({ id }) => !ONLY || ONLY.includes(id));

async function post(tripId, body, label) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": MODE },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  writeFileSync(`${OUT}/${label}.ndjson`, text);
  const frames = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const final = frames.find((f) => f.type === "complete" || f.type === "error");
  if (!final || final.type === "error")
    return { error: final?.error ?? `HTTP ${res.status}`, frames };
  writeFileSync(`${OUT}/${label}.plan.json`, JSON.stringify(final.response.plan, null, 2));
  return { plan: final.response.plan, reply: final.response.reply, frames };
}

async function run(scenario, attempt) {
  const tripId = `e2e-legmode-${scenario.id}`;
  const started = Date.now();
  let result = await post(
    tripId,
    {
      tripId,
      mode: "plan",
      message: "Plan this trip",
      brief: { tripId, userId: "e2e", ...scenario.brief },
    },
    `${scenario.id}-${attempt}-plan`,
  );
  if (!result.error && scenario.follow)
    result = await post(
      tripId,
      {
        tripId,
        mode: "chat",
        message: scenario.follow,
        brief: result.plan.brief,
        plan: result.plan,
      },
      `${scenario.id}-${attempt}-follow`,
    );
  return { ...result, ms: Date.now() - started };
}

const transportOf = (plan) => plan.sections.find((s) => s.id === "transport");

const noModel = (plan) => plan.sections.some((s) => s.proposal?.source?.kind === "fallback");
const hopText = (section, { from, to }) =>
  (section?.proposal?.items ?? [])
    .filter((item) => (item.location ?? "").toLowerCase().includes(to.toLowerCase()))
    .map((item) => `${item.location} :: ${item.detail}`)
    .join(" | ");

function checks({ plan, reply }, scenario) {
  const out = [];
  const check = (ok, message) => out.push({ ok: Boolean(ok), message });
  const section = transportOf(plan);
  const conflicts = JSON.stringify(plan.conflicts ?? []);

  const said = `${section?.proposal?.summary ?? ""} ${(section?.proposal?.assumptions ?? []).join(" ")}`;

  check(plan.sections.length === 5, `5 sections (got ${plan.sections.length})`);
  check(Boolean(section), "a transport section exists");

  if (!scenario.chosen) {
    check(
      !/is not offered/.test(said),
      `no choice reported for a hop that does not exist (${said.slice(0, 200)})`,
    );
    check(
      !(plan.brief.legModes ?? []).some((c) => /sydney/i.test(c.to) && /melbourne/i.test(c.from)),
      "the stale choice was not re-pointed at the real hop",
    );
    return out;
  }

  const { mode, from, to } = scenario.chosen;
  const text = hopText(section, scenario.chosen);
  const honoured = new RegExp(`\\b${mode}\\b`, "i").test(text);
  const reported = new RegExp(`by ${mode} is not offered`, "i").test(said);
  const unschedulable = new RegExp(`by ${mode} cannot fit`, "i").test(conflicts);

  check(
    honoured || reported || unschedulable,
    `${from} → ${to} by ${mode} is either used or reported (${text.slice(0, 200) || said.slice(0, 200)})`,
  );

  if (scenario.expectUnmet) {
    check(reported, `an impossible choice is reported to the traveller (${said.slice(0, 240)})`);

    check(
      !/is not offered/.test(conflicts),
      `the unmet choice is not a conflict (${conflicts.slice(0, 240)})`,
    );
    check(
      !/\bflight\b|carrier/i.test(text),
      `the hop was not quietly flown instead (${text.slice(0, 240)})`,
    );
  } else if (honoured) {
    check(
      !(section?.proposal?.flights ?? []).some((f) => new RegExp(to, "i").test(f.to)),
      `no flight fare was bought for a hop taken by ${mode}`,
    );
    check(
      (plan.brief.legModes ?? []).some((c) => c.mode === mode),
      `the choice survives on the brief (${JSON.stringify(plan.brief.legModes ?? [])})`,
    );
    if (scenario.expectPriced)
      check(
        !/leg\(s\) unpriced/.test(section?.proposal?.summary ?? ""),
        `choosing ${mode} kept its fare (${section?.proposal?.summary ?? ""})`,
      );
    if (scenario.follow)
      check(
        /train|rail/i.test(reply ?? ""),
        `the reply acknowledges the change (${JSON.stringify(reply ?? "").slice(0, 200)})`,
      );
  }
  return out;
}

const summary = [];
for (let attempt = 1; attempt <= RUNS; attempt += 1)
  for (const scenario of SCENARIOS) {
    console.log(`\n== ${scenario.id} (run ${attempt})`);
    const result = await run(scenario, attempt);
    if (result.error) {
      console.log(`FAIL planning error: ${result.error}`);
      summary.push({ id: scenario.id, run: attempt, ms: result.ms, error: result.error });
      continue;
    }
    if (scenario.follow && noModel(result.plan)) {
      const why =
        "no language model configured; the coordinator cannot extract a choice from a sentence";
      console.log(`SKIP ${why}`);
      summary.push({
        id: scenario.id,
        run: attempt,
        ms: result.ms,
        skipped: why,
        modelDependent: true,
      });
      continue;
    }
    const list = checks(result, scenario);
    for (const c of list) console.log(`${c.ok ? "ok  " : "FAIL"} ${c.message}`);
    summary.push({
      id: scenario.id,
      run: attempt,
      passed: list.every((c) => c.ok),
      ms: result.ms,
      modelDependent: Boolean(scenario.follow),
      legModes: result.plan.brief.legModes ?? [],
      conflicts: result.plan.conflicts ?? [],
      checks: list,
    });
  }
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
console.log("\nscenario              passed  median s  model-dependent");
for (const { id } of SCENARIOS) {
  const rows = summary.filter((row) => row.id === id);
  const times = rows.map((row) => row.ms / 1000).sort((a, b) => a - b);
  const skipped = rows.filter((row) => row.skipped).length;
  console.log(
    `${id.padEnd(22)}${(skipped === rows.length ? "skip" : `${rows.filter((row) => row.passed).length}/${rows.length}`).padEnd(8)}${times[Math.floor(times.length / 2)].toFixed(0).padEnd(10)}${SCENARIOS.find((s) => s.id === id)?.follow ? "yes" : "no"}`,
  );
}
console.log(`\nArtifacts: ${OUT}`);
