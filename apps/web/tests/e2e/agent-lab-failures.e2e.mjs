// End-to-end contract for Agent Lab's Failure Lab (#105). From the public page a visitor runs each
// registered fault profile, reads where it failed and whether the workflow carried on, kept a partial
// result or stopped, downloads the artifact (a failed run included) and replays it offline in a fresh
// page. The script recomputes each outcome from the artifacts in plain JavaScript, with no code shared
// with the app. Raw NDJSON, artifacts, evidence, a summary, a report and screenshots land under
// output/playwright/agent-lab-failures/.
//
// Failure inventory, written before implementation:
// - the page offers a fault the server did not register, or sends anything but a registered profile on
//   its own scenario and strategy; the endpoint accepts an unknown id, an object that defines a fault,
//   a fault on another scenario or strategy, or an extra property;
// - a degraded run reads as plain success, or a stopped run as degraded, so the three ways a fault ends
//   (carry on with less, keep a partial result, stop) blur together;
// - provider timeout: the failed flight search is not in the trace under transport, the section is
//   priced anyway or the conflict it leaves is hidden;
// - empty stay search: the workflow invents a stay, or the failed run names no capability or keeps no trace;
// - invalid specialist output: the proposal reaches a plan, or the rejection and its fields are missing;
// - supervisor failure: the fallback is silent, shown as failure, or a specialist runs twice;
// - stalled revision: a revision that does not improve replaces the plan, the loop goes on, or the
//   reason for stopping is missing;
// - a figure on the page (events, failed tool calls, failed specialists, unavailable sections,
//   unresolved conflicts, stopping reason) differs from the artifact it claims to show;
// - a stream, artifact or page carries a stack, a validator message, a raw provider error or a credential;
// - a failed run cannot be downloaded or replayed, or its replay reads differently from the live run:
//   outcome, facts, figures, trace, status; replay needs the network or touches saved chats and trips;
// - Run all skips a profile, runs two at once or keeps going after Cancel;
// - the outcome is not announced, a fault control cannot be reached or operated by keyboard, or the
//   outcome is carried by colour alone;
// - the page overflows horizontally at phone width, or logs a page error.
//
//   pnpm --filter @trip/web dev     # with USE_MOCK_TOOLS=true and no model or provider keys
//   [CHANNEL=chrome] [PLAYWRIGHT=<path to playwright>] node apps/web/tests/e2e/agent-lab-failures.e2e.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/agent-lab-failures");
mkdirSync(OUT, { recursive: true });

// What each registered profile is built for. The page must send exactly this and nothing else.
const PROFILES = {
  "provider-timeout": {
    title: "Flight provider timeout",
    capability: "transport",
    scenarioId: "tokyo-couple",
    strategyId: "multi-agent-no-revision",
    outcome: "degraded",
    status: "complete",
  },
  "provider-empty-result": {
    title: "Empty stay search",
    capability: "accommodation",
    scenarioId: "tokyo-couple",
    strategyId: "multi-agent-no-revision",
    outcome: "failed",
    status: "error",
  },
  "invalid-agent-output": {
    title: "Invalid specialist output",
    capability: "dining",
    scenarioId: "tokyo-couple",
    strategyId: "multi-agent-no-revision",
    outcome: "failed",
    status: "error",
  },
  "supervisor-failure": {
    title: "Supervisor failure",
    capability: "supervisor",
    scenarioId: "tokyo-couple",
    strategyId: "multi-agent-no-revision",
    outcome: "degraded",
    status: "complete",
  },
  "stalled-revision": {
    title: "Stalled revision",
    capability: "transport",
    scenarioId: "tokyo-couple-tight-budget",
    strategyId: "multi-agent-targeted-revision",
    outcome: "partial",
    status: "complete",
  },
};
const IDS = Object.keys(PROFILES);
const LEAKS = [
  "DOMException",
  "TimeoutError",
  "ZodError",
  "aborted due to timeout",
  "expected array",
  "received null",
  "    at ",
  "node_modules",
  "apiKey",
];

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const parseFrames = (body) =>
  body
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const types = (artifact) => artifact.events.map((entry) => entry.event.type);
const eventsOf = (artifact, type) =>
  artifact.events.map((entry) => entry.event).filter((event) => event.type === type);
const name = (agent) => agent.replace(/-/g, " ");

// ---- Independent recomputation of how a run ended, from the artifact alone ------------------------
function recompute(artifact) {
  const toolFailed = eventsOf(artifact, "tool_failed");
  const agentFailed = eventsOf(artifact, "agent_failed");
  const unavailable =
    artifact.status === "completed"
      ? artifact.plan.sections.filter((section) => section.proposal?.source?.kind === "unavailable")
      : [];
  let kind;
  if (artifact.status === "failed") kind = "failed";
  else if (eventsOf(artifact, "lab_supervisor_fallback").length) kind = "degraded";
  else if (toolFailed.length) kind = "degraded";
  else if (artifact.metrics.stopReason === "no_improvement") kind = "partial";
  else kind = "completed";
  return {
    kind,
    figures: {
      Events: String(artifact.events.length),
      "Failed tool calls": String(toolFailed.length),
      "Failed specialists": String(agentFailed.length),
      "Unavailable sections": String(unavailable.length),
      "Unresolved conflicts":
        artifact.status === "completed"
          ? String(artifact.metrics.unresolvedConflicts)
          : "Not applicable",
      "Stopping reason":
        artifact.status === "completed"
          ? ({
              converged: "Converged",
              round_limit: "Round limit reached",
              infeasible_budget: "Infeasible budget",
              no_improvement: "No improvement",
            }[artifact.metrics.stopReason ?? ""] ?? "No loop")
          : "Not applicable",
    },
  };
}

// ---- Browser helpers --------------------------------------------------------------------------------
const card = (page, id) => page.locator(`[data-agent-lab-fault="${id}"]`);
const waitStatus = (page, text) =>
  page.getByRole("status").getByText(text, { exact: true }).waitFor({ timeout: 90_000 });
const statusText = (page) => page.getByRole("status").innerText();

/** What a card shows, read from the page, in a form that can be compared run to run. */
const evidence = (page, id) =>
  card(page, id).evaluate((node) => {
    const text = (item) => item.textContent.replace(/\s+/g, " ").trim();
    const outcome = node.querySelector("[data-agent-lab-fault-outcome]");
    return {
      kind: outcome?.getAttribute("data-outcome") ?? null,
      label: outcome ? text(outcome) : null,
      headline: node.querySelector("[data-agent-lab-fault-headline]")
        ? text(node.querySelector("[data-agent-lab-fault-headline]"))
        : null,
      facts: [...node.querySelectorAll("[data-agent-lab-fault-facts] li")].map(text),
      figures: Object.fromEntries(
        [...node.querySelectorAll("[data-agent-lab-fault-figures] > div")].map((row) => [
          text(row.querySelector("dt")),
          text(row.querySelector("dd")),
        ]),
      ),
      timeline: [...node.querySelectorAll("[data-agent-lab-event]")].map(text),
      sections: node.querySelectorAll("[data-agent-lab-section]").length,
    };
  });

async function open(browser, { width, height, tag }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: "light" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  const response = await page.goto(`${BASE}/agent-lab`);
  check(response?.status() === 200, `${tag}: Agent Lab loads (${response?.status()})`);
  await page.getByRole("heading", { name: "Agent Lab", level: 1 }).waitFor();
  return { context, page, errors };
}

async function main() {
  const browser = await chromium.launch({ channel: process.env.CHANNEL });
  const summary = { profiles: {} };

  // ---- Registration at the endpoint ---------------------------------------------------------------
  const post = (body) =>
    fetch(`${BASE}/api/agent-lab/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const valid = {
    scenarioId: "tokyo-couple",
    strategyId: "multi-agent-no-revision",
    dataMode: "fixture",
    faultProfileId: "provider-timeout",
  };
  for (const [label, body] of [
    ["an unknown fault", { ...valid, faultProfileId: "disk-full" }],
    [
      "a fault the visitor defines",
      { ...valid, faultProfileId: { tool: "searchFlights", error: "boom" } },
    ],
    ["an extra fault property", { ...valid, fault: { tool: "searchFlights" } }],
    ["a fault on the single-agent baseline", { ...valid, strategyId: "single-agent-baseline" }],
    [
      "a fault on a scenario it was not built for",
      { ...valid, scenarioId: "tokyo-couple-tight-budget" },
    ],
    ["a fault on another strategy", { ...valid, strategyId: "multi-agent-targeted-revision" }],
  ]) {
    const response = await post(body);
    check(
      response.status === 400 && (await response.json()).error === "Invalid Agent Lab request",
      `endpoint: ${label} is rejected with 400`,
    );
  }

  // ---- Live runs of every profile -------------------------------------------------------------------
  const live = await open(browser, { width: 1440, height: 1000, tag: "live" });
  const page = live.page;
  const storage = () => page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const storageBefore = await storage();
  const requests = [];
  page.on("request", (request) => {
    if (request.url() === `${BASE}/api/agent-lab/runs` && request.method() === "POST") {
      requests.push(JSON.parse(request.postData() ?? "{}"));
    }
  });

  const views = page.getByRole("group", { name: "View" });
  const failuresButton = views.getByRole("button", { name: "Failures" });
  check((await failuresButton.count()) === 1, "live: the page has a Failures view");
  await failuresButton.click();
  check(
    (await failuresButton.getAttribute("aria-pressed")) === "true",
    "live: the Failures view is marked pressed",
  );
  const cards = page.locator("[data-agent-lab-fault]");
  check(
    same(
      (
        await cards.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-agent-lab-fault")),
        )
      ).sort(),
      [...IDS].sort(),
    ),
    "live: exactly the five registered profiles are offered",
  );
  for (const id of IDS) {
    const text = await card(page, id).innerText();
    const expected = PROFILES[id];
    check(
      text.includes(expected.title) && text.toLowerCase().includes(name(expected.capability)),
      `live: ${id} card names its title and where the fault is injected`,
    );
  }
  check(
    (await page.locator("[data-agent-lab-fault-outcome]").count()) === 0,
    "live: no outcome is shown before a profile has run",
  );

  const artifacts = {};
  const livePage = {};
  for (const id of IDS) {
    const profile = PROFILES[id];
    const responsePromise = page.waitForResponse(
      (candidate) =>
        candidate.url() === `${BASE}/api/agent-lab/runs` && candidate.request().method() === "POST",
    );
    await page.getByRole("button", { name: `Run fault profile: ${profile.title}` }).click();
    const body = await (await responsePromise).text();
    await card(page, id).locator("[data-agent-lab-fault-outcome]").waitFor({ timeout: 90_000 });
    writeFileSync(`${OUT}/${id}.ndjson`, body);
    const frames = parseFrames(body);
    const last = frames.at(-1);
    const artifact = last.artifact;
    artifacts[id] = artifact;
    writeFileSync(`${OUT}/${id}.artifact.json`, JSON.stringify(artifact, null, 2));

    const request = requests.at(-1);
    check(
      same(request, {
        scenarioId: profile.scenarioId,
        strategyId: profile.strategyId,
        dataMode: "fixture",
        faultProfileId: id,
      }),
      `${id}: the page sends exactly the registered profile, scenario and strategy`,
    );
    check(
      last.type === (profile.status === "error" ? "error" : "complete") &&
        artifact.status === (profile.status === "error" ? "failed" : "completed") &&
        artifact.faultProfileId === id,
      `${id}: the stream ends in a ${artifact.status} artifact that names the profile`,
    );
    check(
      frames.filter((frame) => frame.type === "event").length === artifact.events.length &&
        frames
          .filter((frame) => frame.type === "event")
          .every((frame, index) => frame.event.sequence === index + 1),
      `${id}: every recorded event was streamed in order`,
    );
    check(
      types(artifact)[0] === "lab_run_started" &&
        types(artifact)[1] === "lab_fault_injected" &&
        eventsOf(artifact, "lab_fault_injected")[0].profileId === id &&
        eventsOf(artifact, "lab_fault_injected")[0].capability === profile.capability,
      `${id}: the trace opens by saying which fault was injected, and where`,
    );
    check(
      LEAKS.every((leak) => !JSON.stringify(frames).includes(leak)),
      `${id}: the stream carries no stack, validator message or raw provider error`,
    );

    const recomputed = recompute(artifact);
    const shown = await evidence(page, id);
    livePage[id] = shown;
    writeFileSync(`${OUT}/${id}.evidence.json`, JSON.stringify(shown, null, 2));
    check(
      recomputed.kind === profile.outcome && shown.kind === profile.outcome,
      `${id}: the outcome is ${profile.outcome} (recomputed ${recomputed.kind}, page ${shown.kind})`,
    );
    check(
      shown.label !== null && shown.label.trim().length > 0 && shown.headline !== null,
      `${id}: the outcome is a word and a headline, not colour alone ("${shown.label}")`,
    );
    check(
      same(shown.figures, recomputed.figures),
      `${id}: the figures equal those recomputed from the artifact (${JSON.stringify(shown.figures)})`,
    );
    check(
      shown.timeline.length === artifact.events.length,
      `${id}: the card's trace holds all ${artifact.events.length} events`,
    );
    check(
      (await statusText(page)).includes(`${profile.title}: ${shown.label}`),
      `${id}: the outcome is announced in the status region`,
    );
    check(
      LEAKS.every((leak) => !JSON.stringify(shown).includes(leak)),
      `${id}: the card shows no stack, validator message or raw provider error`,
    );

    // What each fault must leave in the trace and the plan.
    if (id === "provider-timeout") {
      const failed = eventsOf(artifact, "tool_failed");
      const transport = artifact.plan.sections.find((section) => section.id === "transport");
      check(
        failed.length > 0 && failed.every((event) => event.agent === "transport"),
        `${id}: the failed flight search is in the trace, under transport`,
      );
      check(
        transport.proposal.source.kind === "unavailable" && transport.estCost === 0,
        `${id}: the transport section is unavailable and was not priced`,
      );
      check(
        artifact.metrics.unresolvedConflicts > 0 &&
          artifact.plan.conflicts.some((item) => item.targetAgent === "transport"),
        `${id}: the conflict the missing fares leave stays visible`,
      );
      check(
        artifact.metrics.rounds === 1 && artifact.metrics.failedAgents === 0,
        `${id}: one round, and no specialist failed: the run carried on with less`,
      );
    }
    if (id === "provider-empty-result") {
      const searched = eventsOf(artifact, "tool_completed").filter(
        (event) => event.agent === "accommodation" && event.resultCount === 0,
      );
      check(searched.length > 0, `${id}: the empty stay search is in the trace`);
      check(
        artifact.failure.code === "agent_failed" &&
          artifact.failure.agent === "accommodation" &&
          artifact.failure.atSequence === artifact.events.length &&
          artifact.metrics.eventCount === artifact.events.length,
        `${id}: the failure names accommodation and the trace recorded before it was kept`,
      );
      check(
        !types(artifact).includes("lab_plan_validated") && shown.sections === 0,
        `${id}: no plan was assembled, so none is shown and none was invented`,
      );
      check(
        shown.facts.some((fact) => /did not invent/i.test(fact)),
        `${id}: the card says the workflow did not invent a stay`,
      );
    }
    if (id === "invalid-agent-output") {
      const rejected = eventsOf(artifact, "lab_agent_output_rejected");
      check(
        rejected.length === 1 &&
          rejected[0].agent === "dining" &&
          rejected[0].fields.includes("items"),
        `${id}: the schema rejection names dining and the rejected field`,
      );
      check(
        types(artifact).indexOf("lab_agent_output_rejected") <
          types(artifact).indexOf("agent_failed") &&
          !types(artifact).includes("lab_evaluation_completed") &&
          shown.sections === 0,
        `${id}: the rejection comes before the failure and no plan or metrics were produced from it`,
      );
      check(
        shown.facts.some((fact) => /schema boundary: items/.test(fact)),
        `${id}: the card names the rejected field`,
      );
    }
    if (id === "supervisor-failure") {
      const order = types(artifact);
      const fallback = eventsOf(artifact, "lab_supervisor_fallback");
      const started = eventsOf(artifact, "agent_started").map((event) => event.agent);
      check(
        fallback.length === 1 &&
          fallback[0].phase === "dispatch" &&
          order.indexOf("lab_supervisor_fallback") < order.indexOf("agent_started"),
        `${id}: the fallback to deterministic dispatch is in the trace before any specialist starts`,
      );
      check(
        artifact.plan.sections.length === 5 && new Set(started).size === started.length,
        `${id}: all five sections were produced and no specialist ran twice`,
      );
    }
    if (id === "stalled-revision") {
      const scored = eventsOf(artifact, "lab_revision_scored");
      check(
        eventsOf(artifact, "lab_revision_started").length === 1 &&
          scored.length === 1 &&
          scored[0].kept === false &&
          scored[0].scoreAfter >= scored[0].scoreBefore,
        `${id}: one revision, scored, and not kept`,
      );
      check(
        eventsOf(artifact, "lab_loop_stopped")[0].reason === "no_improvement" &&
          artifact.metrics.stopReason === "no_improvement" &&
          artifact.metrics.unresolvedConflicts > 0 &&
          artifact.metrics.rounds === 2,
        `${id}: the loop stops as no_improvement with the conflict still reported`,
      );
      check(
        eventsOf(artifact, "lab_conflict_detected")[0].score === scored[0].scoreBefore,
        `${id}: the plan kept is the first round's best known plan`,
      );
    }
    summary.profiles[id] = { outcome: shown.kind, figures: shown.figures };
  }
  check(requests.length === IDS.length, `live: one request per profile run (${requests.length})`);
  await page.screenshot({ path: `${OUT}/desktop-failures.png`, fullPage: true });

  // ---- Download, a failed run included ----------------------------------------------------------------
  const downloads = {};
  for (const id of IDS) {
    const button = page.getByRole("button", {
      name: `Download artifact for ${PROFILES[id].title}`,
    });
    check(
      (await button.count()) === 1,
      `${id}: a download is offered, ${PROFILES[id].status === "error" ? "for a failed run too" : "for the run"}`,
    );
    const [file] = await Promise.all([page.waitForEvent("download"), button.click()]);
    const text = readFileSync(await file.path(), "utf8");
    downloads[id] = file.suggestedFilename();
    writeFileSync(`${OUT}/${id}.download.json`, text);
    check(
      same(JSON.parse(text), artifacts[id]),
      `${id}: the download equals the artifact the stream ended with (${file.suggestedFilename()})`,
    );
  }

  // ---- Keyboard and announcements ----------------------------------------------------------------------
  const runButton = page.getByRole("button", {
    name: `Run fault profile: ${PROFILES["stalled-revision"].title}`,
  });
  await runButton.focus();
  const reran = page.waitForResponse(
    (candidate) =>
      candidate.url() === `${BASE}/api/agent-lab/runs` && candidate.request().method() === "POST",
  );
  await page.keyboard.press("Enter");
  await reran;
  await waitStatus(page, "Stalled revision: Partial result");
  check(true, "keyboard: Enter on a profile's Run button runs it and the outcome is announced");
  const summaryEl = card(page, "stalled-revision").locator("summary").first();
  await summaryEl.focus();
  await page.keyboard.press("Enter");
  check(
    (await card(page, "stalled-revision").locator("details").first().getAttribute("open")) !== null,
    "keyboard: the trace opens from its summary with Enter",
  );

  // ---- Run all, and Cancel -----------------------------------------------------------------------------
  const before = requests.length;
  await page.getByRole("button", { name: "Run all fault profiles" }).click();
  await waitStatus(page, "Fault runs complete");
  const all = requests.slice(before);
  check(
    same(
      all.map((body) => body.faultProfileId),
      IDS,
    ),
    "run all: every profile ran once, one after another, in registry order",
  );
  check(
    (await page.locator("[data-agent-lab-fault-outcome]").count()) === IDS.length,
    "run all: every card shows an outcome",
  );
  await page.getByRole("button", { name: "Run all fault profiles" }).click();
  await page.getByRole("button", { name: "Cancel run" }).waitFor();
  await page.getByRole("button", { name: "Cancel run" }).click();
  await waitStatus(page, "Run cancelled");
  await page.waitForTimeout(1500);
  const after = requests.length - before - all.length;
  check(
    after <= 2,
    `run all: Cancel stops the sequence (${after} request(s) started after the first)`,
  );
  check(
    (await storage()) === storageBefore,
    "live: saved chats, trips and preferences are untouched",
  );
  await live.context.close();

  // ---- Offline replay of every artifact, failed runs included ----------------------------------------------
  const replay = await open(browser, { width: 1440, height: 1000, tag: "replay" });
  const rp = replay.page;
  await replay.context.setOffline(true);
  const apiCalls = [];
  rp.on("request", (request) => request.url().includes("/api/") && apiCalls.push(request.url()));
  for (const id of IDS) {
    await rp
      .locator("input[data-agent-lab-replay-input]")
      .setInputFiles(`${OUT}/${id}.download.json`);
    await waitStatus(rp, "Replaying recorded run");
    await waitStatus(rp, "Replay complete");
    const failuresView = rp
      .getByRole("group", { name: "View" })
      .getByRole("button", { name: "Failures" });
    check(
      (await failuresView.getAttribute("aria-pressed")) === "true",
      `${id}: replaying a fault artifact opens the Failures view`,
    );
    const replayed = await evidence(rp, id);
    check(
      same(replayed, livePage[id]),
      `${id}: the replayed outcome, facts, figures and ${replayed.timeline.length}-event trace equal the live run's`,
    );
    const note = await card(rp, id).locator("[data-agent-lab-replay-note]").innerText();
    check(
      note.includes(artifacts[id].runId) && /replay/i.test(note),
      `${id}: the card says it is a replay and names the recorded run`,
    );
    check(
      (await card(rp, id)
        .locator("[data-agent-lab-fault-outcome]")
        .getAttribute("data-outcome")) === PROFILES[id].outcome,
      `${id}: the replay ends in the same final status (${PROFILES[id].outcome})`,
    );
  }
  check(apiCalls.length === 0, `replay: no /api request while offline (${apiCalls.length})`);
  await rp.screenshot({ path: `${OUT}/desktop-replay-failures.png`, fullPage: true });
  await replay.context.close();

  // ---- Phone ---------------------------------------------------------------------------------------------------
  const phone = await open(browser, { width: 390, height: 844, tag: "phone" });
  await phone.page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Failures" })
    .click();
  await phone.page
    .getByRole("button", { name: `Run fault profile: ${PROFILES["provider-empty-result"].title}` })
    .click();
  await card(phone.page, "provider-empty-result")
    .locator("[data-agent-lab-fault-outcome]")
    .waitFor({ timeout: 90_000 });
  check(
    (await phone.page.evaluate(() => document.documentElement.scrollWidth)) === 390,
    "phone: no horizontal page scroll in the Failures view",
  );
  await phone.page.screenshot({ path: `${OUT}/phone-failures.png`, fullPage: true });
  await phone.context.close();

  const pageErrors = [...live.errors, ...replay.errors, ...phone.errors].filter(
    (message) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(message),
  );
  check(
    pageErrors.length === 0,
    `no page or console errors (${pageErrors.slice(0, 2).join(" | ")})`,
  );
  await browser.close();

  Object.assign(summary, { failures, passed: failures.length === 0, downloads });
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  writeFileSync(
    `${OUT}/report.md`,
    [
      "# Agent Lab Failure Lab",
      "",
      "| Profile | Injected into | Outcome | Failed tool calls | Failed specialists | Unavailable sections |",
      "| --- | --- | --- | --- | --- | --- |",
      ...IDS.map((id) => {
        const figures = summary.profiles[id].figures;
        return `| ${PROFILES[id].title} | ${PROFILES[id].capability} | ${summary.profiles[id].outcome} | ${figures["Failed tool calls"]} | ${figures["Failed specialists"]} | ${figures["Unavailable sections"]} |`;
      }),
      "",
      "Each outcome was recomputed from the artifact in plain JavaScript and matched the page; each artifact, a failed one included, was downloaded and replayed offline with an identical card.",
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
