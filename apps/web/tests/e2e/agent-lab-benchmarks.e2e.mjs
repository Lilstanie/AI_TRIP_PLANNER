import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/agent-lab-benchmarks");
mkdirSync(OUT, { recursive: true });

const STRATEGIES = [
  "single-agent-baseline",
  "multi-agent-no-revision",
  "multi-agent-targeted-revision",
];
const EVALUATOR_VERSION = "scenario-rules-v2";

const PARIS_MINIMUM = 310 * 4 * 2 + 2 * 5 * 140;
const SECTION_IDS = ["accommodation", "destination-guide", "dining", "itinerary", "transport"];

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const parseFrames = (body) =>
  body
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const money = (value) => `A$${Math.round(value).toLocaleString("en-AU")}`;
const section = (plan, id) => plan.sections.find((item) => item.id === id);
const itemsOf = (plan, id) => section(plan, id)?.proposal?.items ?? [];
const eventsOf = (artifact, type) =>
  artifact.events.map((entry) => entry.event).filter((event) => event.type === type);
const stored = (artifact, id) => artifact.metrics.checks.find((item) => item.id === id);

const utc = (iso) =>
  Date.UTC(...iso.split("-").map((part, index) => Number(part) - (index === 1 ? 1 : 0)));
const dayOffset = (from, to) => Math.round((utc(to) - utc(from)) / 86_400_000);

function tripFacts(plan, [first, second]) {
  const [start, end] = plan.brief.dates;
  const nights = dayOffset(start, end);
  const mentions = (item, city) =>
    `${item.location ?? ""} ${item.detail}`.toLowerCase().includes(city.toLowerCase());
  const hop = itemsOf(plan, "transport").find((item) => {
    const text = item.detail.toLowerCase();
    return (
      text.includes(first.toLowerCase()) &&
      text.indexOf(second.toLowerCase()) > text.indexOf(first.toLowerCase())
    );
  });
  const hopDate = hop?.detail.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const hopDay = hopDate ? dayOffset(start, hopDate) + 1 : undefined;
  const stayOf = (city) => {
    const hotels = itemsOf(plan, "accommodation").filter(
      (item) => item.kind === "hotel" && mentions(item, city),
    );
    const dates =
      hotels.length === 1
        ? hotels[0].detail.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/)
        : null;
    return dates && { checkIn: dates[1], checkOut: dates[2] };
  };
  const stays = [stayOf(first), stayOf(second)];
  const activities = itemsOf(plan, "itinerary").filter((item) => item.kind === "activity");
  const rightCity = (item) => {
    const city = item.day < hopDay ? first : second;
    const other = item.day < hopDay ? second : first;
    return mentions(item, city) && !mentions(item, other);
  };
  return {
    hopInsideTrip: hop !== undefined && hopDay >= 2 && hopDay <= nights && hop.day === hopDay,
    everyDayInItsCity:
      hopDay !== undefined &&
      Array.from({ length: nights }, (_, index) => index + 1).every((day) => {
        const onDay = activities.filter((item) => item.day === day);
        return onDay.length > 0 && onDay.every(rightCity);
      }),
    staysHandOver:
      Boolean(stays[0] && stays[1]) &&
      stays[0].checkOut === stays[1].checkIn &&
      stays[1].checkIn === hopDate,
    staysSpanTrip: stays[0]?.checkIn === start && stays[1]?.checkOut === end,
    costsAddUp:
      Math.abs(plan.sections.reduce((sum, item) => sum + item.estCost, 0) - plan.estTotal) < 0.01 &&
      plan.budgetTotal === 6500,
  };
}

async function compare(page, scenarioId, tag) {
  await page.getByLabel("Scenario").selectOption(scenarioId);
  const bodies = [];
  const onResponse = (response) => {
    if (response.url() === `${BASE}/api/agent-lab/runs` && response.request().method() === "POST")
      bodies.push(response.text());
  };
  page.on("response", onResponse);
  await page.getByRole("button", { name: "Compare all strategies" }).click();
  await page
    .getByRole("status")
    .getByText("Run complete", { exact: true })
    .waitFor({ timeout: 120_000 });
  page.off("response", onResponse);
  const texts = await Promise.all(bodies);
  check(texts.length === 3, `${tag}: the three strategies ran (${texts.length} streams)`);
  const artifacts = texts.map((body) => parseFrames(body).at(-1).artifact);
  texts.forEach((body, index) => writeFileSync(`${OUT}/${tag}.${STRATEGIES[index]}.ndjson`, body));
  artifacts.forEach((artifact, index) =>
    writeFileSync(
      `${OUT}/${tag}.${STRATEGIES[index]}.artifact.json`,
      JSON.stringify(artifact, null, 2),
    ),
  );
  check(
    JSON.stringify(artifacts.map((artifact) => artifact.strategyId)) ===
      JSON.stringify(STRATEGIES) &&
      artifacts.every(
        (artifact) => artifact.scenarioId === scenarioId && artifact.status === "completed",
      ),
    `${tag}: three completed artifacts, one per strategy, for ${scenarioId}`,
  );
  check(
    !/(api[_-]?key|secret|chain[- ]of[- ]thought|raw prompt|agent_reasoning)/i.test(texts.join("")),
    `${tag}: the streams carry no sensitive internals or private reasoning`,
  );
  return { artifacts, texts };
}

const cell = async (page, row, index) =>
  (await page.locator(`[data-agent-lab-compare-row="${row}"] td`).nth(index).innerText()).trim();

async function checkPage(page, tag, artifacts, expected) {
  for (const [index, artifact] of artifacts.entries()) {
    const metrics = artifact.metrics;
    const wanted = {
      rounds: String(metrics.rounds),
      budget: metrics.withinBudget
        ? `Within budget, ${money(metrics.budgetHeadroom)} remaining`
        : `Over budget by ${money(-metrics.budgetHeadroom)}`,
      checks: `${metrics.checks.filter((item) => item.passed).length}/${metrics.checks.length} passed`,
      "conflict-outcome": expected.outcome[index],
      "stop-reason": expected.stop[index],
      ...(expected.multiCity ? { "multi-city": expected.multiCity } : {}),
    };
    for (const [row, text] of Object.entries(wanted)) {
      const actual = await cell(page, row, index);
      check(
        actual === text,
        `${tag}: ${artifact.strategyId} ${row} shows "${text}" (page: "${actual}")`,
      );
    }
  }
}

async function main() {
  const browser = await chromium.launch({ channel: process.env.CHANNEL });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.goto(`${BASE}/agent-lab`);
  await page.getByRole("heading", { name: "Agent Lab", level: 1 }).waitFor();
  const storage = () => page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const storageBefore = await storage();
  const summary = { scenarios: {} };

  const options = await page.getByLabel("Scenario").locator("option").allTextContents();
  check(
    options.some((text) => /Paris/.test(text)) && options.some((text) => /Kyoto/.test(text)),
    `the scenario list offers Paris and Tokyo and Kyoto (${options.join(" | ")})`,
  );

  const paris = await compare(page, "paris-family-infeasible", "paris");
  const [pBase, pPlain, pRevise] = paris.artifacts;
  check(
    paris.artifacts.every(
      (artifact) =>
        artifact.versions.fixture === "paris-family-infeasible-v1" &&
        artifact.versions.evaluator === EVALUATOR_VERSION,
    ),
    "paris: every artifact records fixture paris-family-infeasible-v1 and the evaluator version",
  );
  check(
    paris.artifacts.every(
      (artifact) => artifact.plan.brief.budgetTotal === 3000 && artifact.plan.brief.groupSize === 4,
    ),
    "paris: the brief is A$3,000 for four travellers",
  );
  check(
    paris.artifacts.every((artifact) => artifact.plan.estTotal >= PARIS_MINIMUM),
    `paris: no strategy prices the trip below the supported minimum ${money(PARIS_MINIMUM)}`,
  );
  check(
    paris.artifacts.every(
      (artifact) =>
        JSON.stringify(artifact.plan.sections.map((item) => item.id).sort()) ===
        JSON.stringify(SECTION_IDS),
    ),
    "paris: every strategy keeps all five sections",
  );
  check(
    [pPlain, pRevise].every((artifact) => {
      const floors = ["transport", "accommodation"].map(
        (id) => section(artifact.plan, id).proposal.floorCost,
      );
      return floors[0] + floors[1] === PARIS_MINIMUM;
    }),
    "paris: the specialists' own floors add up to the supported minimum",
  );
  check(
    paris.artifacts.every((artifact) =>
      artifact.plan.sections.every((item) => item.estCost >= (item.proposal?.floorCost ?? 0)),
    ),
    "paris: no section is priced below its own evidence floor",
  );
  for (const artifact of [pPlain, pRevise]) {
    const tag = artifact.strategyId;
    const conflicts = eventsOf(artifact, "lab_conflict_detected");
    const stops = eventsOf(artifact, "lab_loop_stopped");
    check(
      conflicts.length === 1 && conflicts[0].infeasible === true && conflicts[0].round === 1,
      `paris: ${tag} reports one infeasible conflict in round 1`,
    );
    check(
      JSON.stringify(conflicts[0]).includes(PARIS_MINIMUM.toFixed(2)) &&
        (artifact.plan.conflicts ?? []).some(
          (item) =>
            item.reason.startsWith("infeasible budget") &&
            item.reason.includes(PARIS_MINIMUM.toFixed(2)),
        ),
      `paris: ${tag} names the supported minimum ${PARIS_MINIMUM.toFixed(2)} in the trace and in the plan`,
    );
    check(
      stops.length === 1 && stops[0].reason === "infeasible_budget" && stops[0].round === 1,
      `paris: ${tag} stops in round 1 as infeasible_budget`,
    );
    check(
      eventsOf(artifact, "lab_revision_started").length === 0 &&
        eventsOf(artifact, "lab_revision_scored").length === 0 &&
        artifact.plan.round === 1 &&
        artifact.metrics.rounds === 1,
      `paris: ${tag} spends no revision round on an impossible budget`,
    );
    check(
      artifact.metrics.checks.every((item) => item.passed) &&
        !stored(artifact, "budget") &&
        !stored(artifact, "no-conflicts"),
      `paris: ${tag} is measured on honesty, not on a budget nobody can meet`,
    );
  }
  check(
    pPlain.metrics.toolCalls === pRevise.metrics.toolCalls &&
      eventsOf(pPlain, "agent_started").length === eventsOf(pRevise, "agent_started").length,
    "paris: targeted revision runs no more specialist work than no revision",
  );
  check(
    pBase.metrics.stopReason === null &&
      pBase.metrics.withinBudget === false &&
      stored(pBase, "infeasibility-reported")?.passed === false &&
      pBase.metrics.checks.filter((item) => !item.passed).length === 1 &&
      (pBase.plan.conflicts ?? []).length === 0,
    "paris: the scripted baseline overruns without reporting the shortfall, and only that check fails",
  );
  check(
    stored(pBase, "evidence-floor")?.passed === true && pBase.plan.estTotal === PARIS_MINIMUM,
    "paris: the baseline stays at the supported minimum, neither above nor fabricated below it",
  );
  await checkPage(page, "paris", paris.artifacts, {
    outcome: ["Not checked", "Infeasible budget", "Infeasible budget"],
    stop: ["No loop", "Infeasible budget", "Infeasible budget"],
  });
  const parisTraces = await page
    .locator("[data-agent-lab-compare-side]")
    .evaluateAll((nodes) => nodes.map((node) => node.innerText));
  check(
    [1, 2].every(
      (index) =>
        /Conflict check · round 1 · infeasible budget/.test(parisTraces[index]) &&
        /Loop stopped · round 1 · Infeasible budget/.test(parisTraces[index]) &&
        !/Revise /.test(parisTraces[index]),
    ),
    "paris: the inspector marks the conflict check as infeasible, the stop by its reason and shows no revision",
  );
  await page.screenshot({ path: `${OUT}/desktop-paris-compare.png`, fullPage: true });
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Run", exact: true })
    .click();
  check(
    (await page
      .locator('[data-agent-lab-check="infeasibility-reported"][data-passed="false"]')
      .count()) === 1 && (await page.locator('[data-agent-lab-check="budget"]').count()) === 0,
    "paris: the baseline's metrics panel lists the unreported shortfall as Failed and has no budget check",
  );
  summary.scenarios.paris = {
    minimum: PARIS_MINIMUM,
    estTotals: paris.artifacts.map((artifact) => artifact.plan.estTotal),
  };

  const kyoto = await compare(page, "tokyo-kyoto-multi-city", "kyoto");
  const [kBase, , kRevise] = kyoto.artifacts;
  const CITIES = ["Tokyo", "Kyoto"];
  check(
    kyoto.artifacts.every(
      (artifact) =>
        artifact.versions.fixture === "tokyo-kyoto-multi-city-v1" &&
        artifact.versions.evaluator === EVALUATOR_VERSION &&
        artifact.plan.brief.destination === "Tokyo & Kyoto" &&
        artifact.plan.brief.dates.join() === "2026-11-10,2026-11-17",
    ),
    "kyoto: every artifact records fixture tokyo-kyoto-multi-city-v1, the evaluator version and the brief",
  );
  const factNames = [
    "hopInsideTrip",
    "everyDayInItsCity",
    "staysHandOver",
    "staysSpanTrip",
    "costsAddUp",
  ];
  const storedIds = [
    "hop-date",
    "itinerary-by-city",
    "stay-transition",
    "trip-dates",
    "total-consistent",
  ];
  for (const artifact of kyoto.artifacts) {
    const facts = tripFacts(artifact.plan, CITIES);
    check(
      factNames.every((name) => facts[name] === true),
      `kyoto: ${artifact.strategyId} satisfies every constraint recomputed from its plan (${JSON.stringify(facts)})`,
    );
    check(
      storedIds.every((id, index) => stored(artifact, id)?.passed === facts[factNames[index]]),
      `kyoto: ${artifact.strategyId} stored checks equal the recomputed constraints`,
    );
    check(
      artifact.metrics.checks.every((item) => item.passed) &&
        artifact.metrics.multiCityConsistent === true,
      `kyoto: ${artifact.strategyId} passes every named check and is consistent across cities`,
    );
    check(
      artifact.metrics.withinBudget && artifact.metrics.unresolvedConflicts === 0,
      `kyoto: ${artifact.strategyId} is within the A$6,500 budget with no unresolved conflict`,
    );
  }
  const hops = kyoto.artifacts.map((artifact) =>
    itemsOf(artifact.plan, "transport").find(
      (item) => /kyoto/i.test(item.detail) && /tokyo/i.test(item.detail),
    ),
  );
  check(
    hops.every((hop) => hop?.day === 4 && /2026-11-13/.test(hop.detail)),
    "kyoto: every strategy moves from Tokyo to Kyoto on day 4, 2026-11-13",
  );

  const shifted = structuredClone(kBase.plan);
  const hotel = itemsOf(shifted, "accommodation").find((item) => /kyoto/i.test(item.detail));
  hotel.detail = hotel.detail.replace("2026-11-13 to", "2026-11-14 to");
  check(
    tripFacts(shifted, CITIES).staysHandOver === false,
    "kyoto: the script's own recomputation detects a stay that starts a day after the move",
  );
  check(
    kRevise.metrics.rounds === 1 &&
      kRevise.metrics.stopReason === "converged" &&
      eventsOf(kRevise, "lab_revision_started").length === 0,
    "kyoto: targeted revision has nothing to repair and stays at one round",
  );
  await checkPage(page, "kyoto", kyoto.artifacts, {
    outcome: ["Not checked", "None found", "None found"],
    stop: ["No loop", "Converged", "Converged"],
    multiCity: "Consistent",
  });
  await page.screenshot({ path: `${OUT}/desktop-kyoto-compare.png`, fullPage: true });
  summary.scenarios.kyoto = {
    move: "2026-11-13",
    estTotals: kyoto.artifacts.map((artifact) => artifact.plan.estTotal),
  };

  check((await storage()) === storageBefore, "saved chats, trips and preferences are untouched");

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
  });
  const small = await phone.newPage();
  small.on("pageerror", (error) => errors.push(String(error)));
  await small.goto(`${BASE}/agent-lab`);
  await small.getByLabel("Scenario").selectOption("paris-family-infeasible");
  await small.getByRole("button", { name: "Compare all strategies" }).click();
  await small
    .getByRole("status")
    .getByText("Run complete", { exact: true })
    .waitFor({ timeout: 120_000 });
  check(
    (await small.evaluate(() => document.documentElement.scrollWidth)) === 390,
    "phone: no horizontal page scroll on the Paris comparison",
  );
  await small.screenshot({ path: `${OUT}/phone-paris-compare.png`, fullPage: true });
  await phone.close();

  check(errors.length === 0, `no page or console errors (${errors.slice(0, 2).join(" | ")})`);
  await browser.close();

  Object.assign(summary, { failures, passed: failures.length === 0 });
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  writeFileSync(
    `${OUT}/report.md`,
    [
      "# Agent Lab benchmark scenarios",
      "",
      `- Paris family (A$3,000, four travellers): supported minimum ${money(PARIS_MINIMUM)}; estimates ${summary.scenarios.paris.estTotals.map(money).join(", ")}. Both multi-agent strategies stop in round 1 as infeasible_budget and name the minimum; the baseline overruns without reporting it.`,
      `- Tokyo and Kyoto (seven nights): every strategy moves on 2026-11-13 with matching stays, activities and costs, recomputed in plain JavaScript; estimates ${summary.scenarios.kyoto.estTotals.map(money).join(", ")}.`,
      "",
      failures.length
        ? `Failures:\n${failures.map((item) => `- ${item}`).join("\n")}`
        : "Result: pass.",
      "",
    ].join("\n"),
  );
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll checks passed. Evidence: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
