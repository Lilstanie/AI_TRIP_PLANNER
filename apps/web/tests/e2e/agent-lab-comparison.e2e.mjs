// End-to-end contract for Agent Lab's strategy comparison. From the public page a visitor runs the
// single-agent baseline and the five-specialist no-revision strategy, inspects the typed trace and
// reads both results side by side. Raw NDJSON, parsed artifacts, a summary and desktop/phone
// screenshots land under output/playwright/agent-lab-comparison/ as repeatable evidence.
//
// Failure inventory, written before implementation:
// - the multi-agent strategy cannot be requested, or is rejected as an unknown strategy;
// - a comparison run never starts the second strategy, or runs them at the same time and mixes events;
// - the multi-agent run revises (more than one round) or its trace shows a revision stage;
// - the inspector cannot tell graph stages, specialist lifecycle and tool calls apart, or hides a
//   specialist's objective, constraints or outcome;
// - a figure in the comparison table differs from the artifact it claims to show;
// - the page ranks the strategies, or omits that the comparison measures specialization only;
// - the page does not explain why budgeting, conflict checks, maps and weather are not agents;
// - the two runs of one request produce different plans (fixture mode must repeat exactly);
// - a cancelled comparison leaves a stale plan or a number for the strategy that never ran;
// - raw prompts, secrets or private chain-of-thought reach the stream, the page or an artifact;
// - the comparison cannot be reached or operated by keyboard, or overflows horizontally on a phone;
// - the run touches workspace storage.
//
//   pnpm --filter @trip/web dev
//   [CHANNEL=chrome] [PLAYWRIGHT=<path to playwright>] node apps/web/tests/e2e/agent-lab-comparison.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/agent-lab-comparison");
mkdirSync(OUT, { recursive: true });

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
const completeOf = (body) => parseFrames(body).at(-1);
const money = (value) => `A$${Math.round(value).toLocaleString("en-AU")}`;

// The expected text for each comparison row, derived here from the artifact so the page's figures are
// checked against the run record and not against the page's own formatting code.
const expectedRows = (metrics) => ({
  latency: `${metrics.latencyMs} ms`,
  rounds: String(metrics.rounds),
  "tool-calls": String(metrics.toolCalls),
  fallbacks: String(metrics.fallbacks),
  "failed-agents": String(metrics.failedAgents),
  budget: metrics.withinBudget
    ? `Within budget, ${money(metrics.budgetHeadroom)} remaining`
    : `Over budget by ${money(-metrics.budgetHeadroom)}`,
  conflicts: String(metrics.unresolvedConflicts),
  checks: `${metrics.checks.filter((item) => item.passed).length}/${metrics.checks.length} passed`,
});

async function run(browser, { width, height, tag }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: "light" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  const bodies = [];
  // Only runs started after the cancelled one are evidence; an aborted response has no readable body.
  let capture = false;
  page.on("response", (response) => {
    if (
      capture &&
      response.url() === `${BASE}/api/agent-lab/runs` &&
      response.request().method() === "POST"
    )
      bodies.push(response.text());
  });

  await page.goto(`${BASE}/agent-lab`);
  await page.getByRole("heading", { name: "Agent Lab", level: 1 }).waitFor();
  const workspaceStorage = () =>
    page.evaluate(() =>
      JSON.stringify({
        catalog: localStorage.getItem("trip-workspace-catalog-v3"),
        current: localStorage.getItem("trip-workspace-v1"),
      }),
    );
  const storageBefore = await workspaceStorage();

  check(
    (await page.getByLabel("Strategy").locator("option").allTextContents()).length === 2,
    `${tag}: both strategies are selectable`,
  );
  check(
    (await page.getByRole("button", { name: "Compare strategies" }).isDisabled()) === true,
    `${tag}: comparison view is unavailable before any run`,
  );

  // Cancelling a comparison must not leave a number for the strategy that never ran.
  await page.getByRole("button", { name: "Compare both strategies" }).click();
  const cancel = page.getByRole("button", { name: "Cancel run" });
  await cancel.waitFor();
  await cancel.click();
  await page.getByRole("status").getByText("Run cancelled", { exact: true }).waitFor();
  check(
    (await page.locator('[data-agent-lab-compare-row="rounds"] td[data-not-run="true"]').count()) >=
      1,
    `${tag}: a strategy that did not finish shows No completed run, not a number`,
  );
  await page.waitForTimeout(500);
  capture = true;

  // Keyboard path to the comparison action.
  await page.getByLabel("Strategy").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  check(
    await page
      .getByRole("button", { name: "Compare both strategies" })
      .evaluate((element) => element === document.activeElement),
    `${tag}: Tab reaches Compare both strategies`,
  );
  await page.keyboard.press("Enter");
  await page
    .getByRole("status")
    .getByText("Run complete", { exact: true })
    .waitFor({ timeout: 30000 });
  const [singleBody, multiBody] = await Promise.all(bodies);
  check(bodies.length === 2, `${tag}: comparison issued exactly two runs, one per strategy`);
  writeFileSync(`${OUT}/${tag}.single.ndjson`, singleBody);
  writeFileSync(`${OUT}/${tag}.multi.ndjson`, multiBody);
  const single = completeOf(singleBody).artifact;
  const multi = completeOf(multiBody).artifact;
  writeFileSync(`${OUT}/${tag}.single.artifact.json`, JSON.stringify(single, null, 2));
  writeFileSync(`${OUT}/${tag}.multi.artifact.json`, JSON.stringify(multi, null, 2));

  check(
    single.strategyId === "single-agent-baseline",
    `${tag}: first run is the single-agent baseline`,
  );
  check(
    multi.strategyId === "multi-agent-no-revision",
    `${tag}: second run is the no-revision multi-agent strategy`,
  );
  check(
    single.status === "completed" && multi.status === "completed",
    `${tag}: both artifacts completed`,
  );
  check(
    multi.plan.sections.length === 5 && single.plan.sections.length === 5,
    `${tag}: both return the same five-section plan shape`,
  );
  check(
    JSON.stringify(single.plan.brief) === JSON.stringify(multi.plan.brief),
    `${tag}: both strategies planned the same brief`,
  );
  check(
    multi.metrics.rounds === 1 && multi.plan.round === 1,
    `${tag}: multi-agent ran exactly one round`,
  );

  const types = multi.events.map((item) => item.event.type);
  const phases = multi.events.flatMap((item) =>
    item.event.type === "coordinator" ? [item.event.phase] : [],
  );
  check(
    JSON.stringify(phases) === JSON.stringify(["dispatch", "conflicts", "assembly"]),
    `${tag}: graph stages are dispatch, conflicts, assembly with no revision (${phases.join(", ")})`,
  );
  const agents = new Set(
    multi.events.flatMap((item) =>
      item.event.type === "agent_completed" ? [item.event.agent] : [],
    ),
  );
  check(
    ["itinerary", "transport", "accommodation", "destination-guide", "dining"].every((name) =>
      agents.has(name),
    ),
    `${tag}: all five specialists completed in the trace`,
  );
  check(
    types.includes("tool_started") && types.includes("tool_completed"),
    `${tag}: trace carries tool summaries`,
  );
  check(
    multi.events.some((item) => item.event.type === "agent_started" && item.event.objective),
    `${tag}: a specialist's bounded objective is recorded`,
  );
  check(
    multi.events.some((item) => item.event.type === "agent_completed" && item.event.outcome),
    `${tag}: a specialist's outcome is recorded`,
  );
  check(
    !/(api[_-]?key|secret|chain[- ]of[- ]thought|raw prompt|agent_reasoning)/i.test(
      singleBody + multiBody,
    ),
    `${tag}: streams contain no sensitive internals or private reasoning`,
  );

  // The comparison table must say exactly what each artifact says.
  for (const [index, artifact] of [single, multi].entries()) {
    const expected = expectedRows(artifact.metrics);
    for (const [row, text] of Object.entries(expected)) {
      const actual = (
        await page.locator(`[data-agent-lab-compare-row="${row}"] td`).nth(index).innerText()
      ).trim();
      check(
        actual === text,
        `${tag}: ${artifact.strategyId} ${row} shows "${text}" (page: "${actual}")`,
      );
    }
  }
  check(
    (await page.locator("[data-agent-lab-compare-side]").count()) === 2,
    `${tag}: both plans are shown side by side`,
  );
  check(
    (await page.locator("[data-agent-lab-compare-side] [data-agent-lab-section]").count()) === 10,
    `${tag}: the page renders ten plan sections, five per strategy`,
  );
  check(
    (await page.locator("[data-agent-lab-compare-side] [data-agent-lab-event]").count()) ===
      single.events.length + multi.events.length,
    `${tag}: the page renders every event of both traces`,
  );
  const body = await page.locator("main").innerText();
  check(
    /measures specialization only/i.test(body),
    `${tag}: page states that it measures specialization, not revision`,
  );
  check(
    /graph nodes or tools/i.test(body) && /budgeting, conflict checks/i.test(body),
    `${tag}: page explains why budgeting and conflict checks are not agents`,
  );
  check(
    !/\b(winner|better|best|worse)\b/i.test(await page.locator(".agent-lab__compare").innerText()),
    `${tag}: the comparison does not rank the strategies`,
  );

  // The inspector shows the multi-agent trace with each kind of event distinguishable.
  await page.getByRole("button", { name: "Inspect one run" }).click();
  await page.getByLabel("Strategy").selectOption("multi-agent-no-revision");
  const kinds = await page
    .locator("[data-agent-lab-event]")
    .evaluateAll((nodes) => [
      ...new Set(nodes.map((node) => node.getAttribute("data-event-kind"))),
    ]);
  check(
    ["run", "graph", "specialist", "tool"].every((kind) => kinds.includes(kind)),
    `${tag}: inspector distinguishes run, graph, specialist and tool events (${kinds.join(", ")})`,
  );
  check(
    (await page.locator("[data-agent-lab-event]").count()) === multi.events.length,
    `${tag}: inspector renders every multi-agent event`,
  );
  check(
    (await page.getByText("Graph stage", { exact: true }).count()) >= 3 &&
      (await page.getByText("Specialist", { exact: true }).count()) >= 5,
    `${tag}: inspector labels graph stages and specialists in words`,
  );
  await page.getByRole("button", { name: "Compare strategies" }).click();

  check(
    (await workspaceStorage()) === storageBefore,
    `${tag}: Agent Lab does not mutate workspace storage`,
  );
  check(
    await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth),
    `${tag}: no horizontal page overflow`,
  );
  check(
    !errors.length,
    `${tag}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
  );
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
  await context.close();
  return { single, multi };
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
let desktop;
let phone;
try {
  desktop = await run(browser, { width: 1440, height: 1000, tag: "desktop" });
  phone = await run(browser, { width: 390, height: 844, tag: "phone" });
} finally {
  await browser.close();
}

// Fixture mode repeats exactly: the same request in two separate sessions yields the same plan and trace.
const strip = (artifact) =>
  JSON.stringify({ plan: artifact.plan, events: artifact.events.map((item) => item.event) });
check(
  strip(desktop.multi) === strip(phone.multi),
  "multi-agent fixture repeats exactly across sessions",
);
check(
  strip(desktop.single) === strip(phone.single),
  "single-agent fixture repeats exactly across sessions",
);

writeFileSync(
  `${OUT}/summary.json`,
  JSON.stringify({ passed: failures.length === 0, failures }, null, 2),
);
console.log(`\nArtifacts: ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} check(s) failed`);
  process.exit(1);
}
