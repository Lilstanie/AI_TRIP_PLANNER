// End-to-end contract for Agent Lab's targeted-revision strategy. On the tight-budget scenario a visitor
// compares all three strategies from the public page and sees the conflict, the specialist asked to
// revise, what it replaced, the score change and why the loop stopped. Raw NDJSON, parsed artifacts, a
// summary and desktop/phone screenshots land under output/playwright/agent-lab-revision/.
//
// Failure inventory, written before implementation:
// - the tight scenario has no conflict (nothing to repair) or an infeasible one (nothing can repair it);
// - targeted revision is not available from the public page, or the request is accepted without being
//   registered;
// - the revision strategy saw different evidence from the no-revision strategy, so a difference could
//   come from the data rather than targeted revision;
// - the trace omits the conflict, the targeted specialist, the previous outcome, the revision objective,
//   the score before and after, the round or the stopping reason, or the page hides them;
// - a specialist the conflict did not name runs again;
// - a revision that made the plan worse replaces the best known plan, or the loop is unbounded;
// - a figure on the page differs from a value recomputed from the artifact's plan and trace alone, which
//   would mean the evaluation depends on something outside the artifact;
// - missing token or model cost shows as a number, most dangerously 0;
// - the page claims a winner, or presents five specialists as a permanent number;
// - the page overflows on a phone, or the run touches workspace storage.
//
//   pnpm --filter @trip/web dev   (with USE_MOCK_TOOLS=true and no model or provider keys)
//   [CHANNEL=chrome] [PLAYWRIGHT=<path to playwright>] node apps/web/tests/e2e/agent-lab-revision.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/agent-lab-revision");
mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const completeOf = (body) =>
  body
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .at(-1);
const money = (value) => `A$${Math.round(value).toLocaleString("en-AU")}`;

// Metrics recomputed here from the artifact's plan and trace alone, with no code shared with the app.
// Everything except wall time must come out equal to what the artifact stored.
function recompute(artifact) {
  const { plan, events } = artifact;
  const payloads = events.map((item) => item.event);
  const count = (...types) => payloads.filter((event) => types.includes(event.type)).length;
  const items = plan.sections.flatMap((section) => section.proposal?.items ?? []);
  const stops = (
    plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? []
  ).filter((item) => item.kind === "activity");
  const norm = (text) => text.trim().replace(/\s+/g, " ").toLowerCase();
  const seen = new Set();
  let duplicateStops = 0;
  for (const stop of stops) {
    if (!stop.location || !norm(stop.location)) continue;
    if (seen.has(norm(stop.location))) duplicateStops += 1;
    seen.add(norm(stop.location));
  }
  const generic = (location) =>
    !location ||
    !norm(location) ||
    norm(location) === "tokyo" ||
    /\bnear\b/.test(norm(location)) ||
    /^(mock |generic )?(attraction|restaurant|place|sight|museum|cafe|landmark|venue)\b/.test(
      norm(location),
    );
  const meals = items.filter((item) => item.kind === "meal");
  const stopped = [...payloads].reverse().find((event) => event.type === "lab_loop_stopped");
  const passed = {
    sections: plan.sections.length === 5,
    budget: plan.estTotal <= plan.budgetTotal,
    "no-conflicts": (plan.conflicts ?? []).length === 0,
    destination: plan.brief.destination === "Tokyo",
    "no-early-starts": !items.some(
      (item) => item.startTime !== undefined && item.startTime < "10:00",
    ),
    "vegetarian-meals": meals.length > 0 && meals.every((meal) => /vegetarian/i.test(meal.detail)),
  };
  return {
    withinBudget: plan.estTotal <= plan.budgetTotal,
    budgetHeadroom: plan.budgetTotal - plan.estTotal,
    sectionCount: plan.sections.length,
    checks: artifact.metrics.checks.map((item) => ({ id: item.id, passed: passed[item.id] })),
    rounds: Math.max(1, plan.round),
    toolCalls: count("tool_completed", "lab_tool_completed"),
    fallbacks: plan.sections.filter((section) => section.proposal?.source?.kind === "fallback")
      .length,
    failedAgents: count("agent_failed"),
    unresolvedConflicts: (plan.conflicts ?? []).length,
    groundedSections: plan.sections.filter((section) =>
      ["live", "estimated", "mock"].includes(section.proposal?.source?.kind),
    ).length,
    duplicateStops,
    genericStops: stops.filter((stop) => generic(stop.location)).length,
    multiCityConsistent: null,
    stopReason: stopped?.reason ?? null,
    eventCount: events.length,
  };
}
// Key order is not part of a metric, so compare with keys sorted.
const canonical = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
const withoutLabels = (checks) => checks.map((item) => ({ id: item.id, passed: item.passed }));

async function run(browser, { width, height, tag }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: "light" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  const bodies = [];
  page.on("response", (response) => {
    if (response.url() === `${BASE}/api/agent-lab/runs` && response.request().method() === "POST")
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

  await page
    .locator(".agent-lab__field")
    .first()
    .locator("select")
    .selectOption("tokyo-couple-tight-budget");
  check(
    (await page.getByLabel("Strategy").locator("option").allTextContents()).some((text) =>
      /targeted revision/i.test(text),
    ),
    `${tag}: targeted revision is selectable from the public page`,
  );
  await page.getByRole("button", { name: "Compare all strategies" }).click();
  await page
    .getByRole("status")
    .getByText("Run complete", { exact: true })
    .waitFor({ timeout: 30000 });
  const [singleBody, plainBody, revisingBody] = await Promise.all(bodies);
  check(bodies.length === 3, `${tag}: three runs were issued, one per strategy`);
  for (const [name, body] of [
    ["single", singleBody],
    ["plain", plainBody],
    ["revising", revisingBody],
  ]) {
    writeFileSync(`${OUT}/${tag}.${name}.ndjson`, body);
    writeFileSync(
      `${OUT}/${tag}.${name}.artifact.json`,
      JSON.stringify(completeOf(body).artifact, null, 2),
    );
  }
  const single = completeOf(singleBody).artifact;
  const plain = completeOf(plainBody).artifact;
  const revising = completeOf(revisingBody).artifact;

  check(
    [single, plain, revising].every(
      (artifact) =>
        artifact.status === "completed" && artifact.scenarioId === "tokyo-couple-tight-budget",
    ),
    `${tag}: all three strategies completed on the tight-budget scenario`,
  );
  check(
    plain.metrics.rounds === 1 &&
      plain.metrics.unresolvedConflicts > 0 &&
      !plain.metrics.withinBudget,
    `${tag}: without revision the first round's conflict stays unresolved and over budget`,
  );
  check(
    revising.metrics.rounds === 2 &&
      revising.metrics.unresolvedConflicts === 0 &&
      revising.metrics.withinBudget &&
      revising.metrics.stopReason === "converged",
    `${tag}: targeted revision repairs it in a second round and converges`,
  );

  // The first round is the same evidence for both multi-agent strategies.
  const graphEvents = (artifact) => {
    const list = artifact.events
      .map((item) => item.event)
      .filter((event) => !event.type.startsWith("lab_"));
    return list.slice(
      0,
      list.findIndex((e) => e.type === "coordinator" && e.phase === "conflicts") + 1,
    );
  };
  check(
    JSON.stringify(graphEvents(plain)) === JSON.stringify(graphEvents(revising)),
    `${tag}: both multi-agent strategies share the same first round`,
  );

  // The trace names every part of the repair.
  const events = revising.events.map((item) => item.event);
  const conflict = events.find((event) => event.type === "lab_conflict_detected");
  check(
    conflict?.round === 1 &&
      conflict.conflicts.length === 1 &&
      conflict.conflicts[0].agent === "transport",
    `${tag}: trace names the conflict and its targeted specialist (transport, round 1)`,
  );
  check(
    /over budget/.test(conflict?.conflicts[0].reason ?? ""),
    `${tag}: trace states the conflict reason`,
  );
  const started = events.find((event) => event.type === "lab_revision_started");
  check(
    started?.agent === "transport" &&
      /^Fix: /.test(started.objective) &&
      /AUD 1680/.test(started.previousOutcome),
    `${tag}: trace states the revision objective and the previous outcome`,
  );
  const scored = events.find((event) => event.type === "lab_revision_scored");
  check(
    scored?.round === 2 &&
      scored.kept === true &&
      scored.scoreBefore > scored.scoreAfter &&
      scored.scoreBefore === conflict.score,
    `${tag}: trace states the score before and after and that the revision was kept`,
  );
  const stopped = events.find((event) => event.type === "lab_loop_stopped");
  check(
    stopped?.round === 2 && stopped.reason === "converged" && stopped.unresolved === 0,
    `${tag}: trace states the round and the stopping reason`,
  );
  const reran = events
    .filter((event) => event.type === "agent_started" && event.round === 2)
    .map((e) => e.agent);
  check(
    JSON.stringify(reran) === JSON.stringify(["transport"]),
    `${tag}: only the named specialist ran again (${reran.join(", ")})`,
  );
  check(
    !/(api[_-]?key|secret|chain[- ]of[- ]thought|raw prompt|agent_reasoning)/i.test(
      singleBody + plainBody + revisingBody,
    ),
    `${tag}: streams contain no sensitive internals or private reasoning`,
  );

  // Every stored metric equals its recomputation from the final plan and trace, and the page shows it.
  const table = async (row, index) =>
    (await page.locator(`[data-agent-lab-compare-row="${row}"] td`).nth(index).innerText()).trim();
  for (const [index, artifact] of [single, plain, revising].entries()) {
    const stored = { ...artifact.metrics };
    delete stored.durationMs;
    delete stored.latencyMs;
    delete stored.usage;
    stored.checks = withoutLabels(stored.checks);
    const again = recompute(artifact);
    check(
      canonical(stored) === canonical(again),
      `${tag}: ${artifact.strategyId} stored metrics equal their recomputation from plan and trace`,
    );
    check(
      (await table("rounds", index)) === String(again.rounds) &&
        (await table("conflicts", index)) === String(again.unresolvedConflicts) &&
        (await table("tool-calls", index)) === String(again.toolCalls) &&
        (await table("fallbacks", index)) === String(again.fallbacks) &&
        (await table("failed-agents", index)) === String(again.failedAgents) &&
        (await table("grounding", index)) ===
          `${again.groundedSections}/${again.sectionCount} sections` &&
        (await table("duplicate-stops", index)) === String(again.duplicateStops) &&
        (await table("generic-stops", index)) === String(again.genericStops) &&
        (await table("budget", index)) ===
          (again.withinBudget
            ? `Within budget, ${money(again.budgetHeadroom)} remaining`
            : `Over budget by ${money(-again.budgetHeadroom)}`) &&
        (await table("checks", index)) ===
          `${again.checks.filter((item) => item.passed).length}/${again.checks.length} passed`,
      `${tag}: ${artifact.strategyId} page figures equal the recomputed metrics`,
    );
    check(
      (await table("usage", index)) === "Unavailable" &&
        artifact.metrics.usage.status === "unavailable",
      `${tag}: ${artifact.strategyId} token and model cost is Unavailable, not a number`,
    );
  }
  check(
    (await table("stop-reason", 0)) === "No loop" &&
      (await table("stop-reason", 1)) === "Round limit reached" &&
      (await table("stop-reason", 2)) === "Converged",
    `${tag}: stopping reasons read No loop, Round limit reached and Converged`,
  );

  const body = await page.locator("main").innerText();
  check(
    /what targeted revision adds/i.test(body) && /measures specialization only/i.test(body),
    `${tag}: page says which comparison measures specialization and which measures what targeted revision adds`,
  );
  // The explanation lives in the Architecture view; read it there, then return to the comparison.
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Architecture", exact: true })
    .click();
  check(
    /not a fixed number/i.test(await page.locator("[data-agent-lab-architecture]").innerText()),
    `${tag}: Architecture does not present five specialists as a permanent number`,
  );
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Compare", exact: true })
    .click();
  check(
    !/\b(winner|better|best|worse)\b/i.test(await page.locator(".agent-lab__compare").innerText()),
    `${tag}: the comparison does not rank the strategies`,
  );

  // The inspector shows the repair in words.
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Run", exact: true })
    .click();
  await page.getByLabel("Strategy").selectOption("multi-agent-targeted-revision");
  const trace = await page.locator("[data-agent-lab-event]").allInnerTexts();
  const has = (pattern) => trace.some((row) => pattern.test(row));
  check(
    has(/Conflict check · round 1[\s\S]*transport[\s\S]*over budget/i),
    `${tag}: inspector shows the conflict and its target`,
  );
  check(
    has(/Revise transport · round 2[\s\S]*Fix: [\s\S]*Previous outcome[\s\S]*AUD 1680/i),
    `${tag}: inspector shows the objective and previous outcome`,
  );
  check(
    has(/Revision scored · round 2[\s\S]*revision kept/i),
    `${tag}: inspector shows the score result`,
  );
  check(
    has(/Loop stopped · round 2[\s\S]*No conflicts remain/i),
    `${tag}: inspector shows the stopping reason`,
  );
  check(
    trace.filter((row) => /transport started/i.test(row)).length === 2 &&
      trace.filter((row) => /(itinerary|accommodation|dining|destination guide) started/i.test(row))
        .length === 4,
    `${tag}: inspector shows transport twice and no other specialist rerun`,
  );
  check(
    (await page.getByText("Unavailable", { exact: true }).count()) >= 1,
    `${tag}: inspector reports token and model cost as Unavailable`,
  );
  check(
    trace.some((row) => /transport started · round 2/i.test(row)) &&
      trace.some((row) => /transport completed · round 2/i.test(row)),
    `${tag}: the revised specialist's rows say round 2`,
  );
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Compare", exact: true })
    .click();

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

  // A result belongs to the scenario that produced it: changing the scenario clears it.
  await page.locator(".agent-lab__field").first().locator("select").selectOption("tokyo-couple");
  check(
    (await page.locator('[data-agent-lab-compare-row] td[data-not-run="false"]').count()) === 0 &&
      (await page.locator("[data-agent-lab-event]").count()) === 0 &&
      (await page.locator("[data-agent-lab-section]").count()) === 0,
    `${tag}: changing the scenario clears the previous scenario's results`,
  );
  await context.close();
  return { single, plain, revising };
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

const strip = (artifact) =>
  JSON.stringify({ plan: artifact.plan, events: artifact.events.map((item) => item.event) });
for (const name of ["single", "plain", "revising"]) {
  check(
    strip(desktop[name]) === strip(phone[name]),
    `${name} fixture repeats exactly across sessions`,
  );
}

writeFileSync(
  `${OUT}/summary.json`,
  JSON.stringify({ passed: failures.length === 0, failures }, null, 2),
);
console.log(`\nArtifacts: ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} check(s) failed`);
  process.exit(1);
}
