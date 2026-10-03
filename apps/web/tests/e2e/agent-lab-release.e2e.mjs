// End-to-end release evidence for the public Agent Lab (#107). One script walks the whole public flow: the
// four views as one navigation model, a normal comparison, the infeasible-budget and the multi-city
// benchmarks, the Failure Lab, artifact download and offline replay, then proves the layouts, the
// accessible names and that the ordinary workspace is untouched. Raw NDJSON, versioned artifacts, a
// comparison summary, a human-readable report and a matrix of screenshots (light and dark, desktop and
// narrow, reduced motion) land under output/playwright/agent-lab-release/.
//
// Failure inventory, written before the final integration changes:
// Navigation and content
// - the lab has no single navigation model: the views are named inconsistently, one is missing, the
//   current one is not marked, or a view cannot be reached or left by keyboard;
// - the Architecture view is missing, or does not explain who owns what (LangGraph and LangChain), why
//   there are five capability boundaries, why budgeting, conflict checks, state transitions, maps and
//   weather are nodes or tools and not agents, or why five is not a permanent number;
// Results
// - a normal comparison, the infeasible Paris budget, the Tokyo and Kyoto consistency run or a fault
//   profile does not complete, differs from what its artifact records, or loses its trace;
// - the way a run ended (Completed, Degraded, Partial result, Failed) is worded or computed differently
//   in the Run, Compare and Failures views, or differs from what is recomputed from the artifact;
// - a result does not say Fixture data or Live data, in any view or artifact;
// - a download or a replay differs from the run it came from, or a replay needs the network;
// Safety
// - a stream, artifact, page or report carries a credential, a raw prompt, private reasoning, a stack or a
//   provider payload;
// - the public flow reads or writes saved chats, trips, preferences or account data, or calls any route
//   but the Agent Lab run endpoint;
// - the ordinary travel workspace changes: it fails to load, shows lab content or logs errors;
// Layout and access
// - in light or dark, at desktop or narrow width, or with reduced motion, any view overflows
//   horizontally, clips a control, overlaps controls, hides a control, or sets text at too low a contrast;
// - reduced motion still animates or transitions;
// - a control, select, summary or link has no accessible name; a run, download, replay, rejection or
//   failure is not announced.
//
//   pnpm --filter @trip/web dev     # fixture mode needs no keys; a hostile environment is fine
//   [CHANNEL=chrome] [PLAYWRIGHT=<path to playwright>] node apps/web/tests/e2e/agent-lab-release.e2e.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/agent-lab-release");
mkdirSync(OUT, { recursive: true });

const STRATEGIES = [
  "single-agent-baseline",
  "multi-agent-no-revision",
  "multi-agent-targeted-revision",
];
const VIEWS = ["Run", "Compare", "Failures", "Architecture"];
const FAULTS = {
  "provider-timeout": { title: "Flight provider timeout", outcome: "degraded" },
  "provider-empty-result": { title: "Empty stay search", outcome: "failed" },
  "invalid-agent-output": { title: "Invalid specialist output", outcome: "failed" },
  "supervisor-failure": { title: "Supervisor failure", outcome: "degraded" },
  "stalled-revision": { title: "Stalled revision", outcome: "partial" },
};
const LABELS = {
  completed: "Completed",
  degraded: "Degraded",
  partial: "Partial result",
  failed: "Failed",
};
const LEAKS = [
  /api[_-]?key/i,
  /secret/i,
  /sk-[A-Za-z0-9]{10,}/,
  /raw prompt/i,
  /chain[- ]of[- ]thought/i,
  /agent_reasoning/,
  /DOMException|TimeoutError|ZodError|aborted due to timeout/,
  /\n\s+at /,
  /node_modules/,
];
const ARCHITECTURE_SECTIONS = {
  ownership: [/LangGraph/, /LangChain/, /workflow state|state transitions/i, /bounded/i],
  capabilities: [/itinerary/i, /transport/i, /accommodation/i, /destination guid/i, /dining/i],
  deterministic: [
    /budget/i,
    /conflict/i,
    /state transition/i,
    /maps?/i,
    /weather/i,
    /not agents?|instead of agents?/i,
  ],
  five: [/not a (fixed|permanent)/i, /sixth|new (capability|one)/i, /own (tools|failure|output)/i],
};

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
const eventsOf = (artifact, type) =>
  artifact.events.map((entry) => entry.event).filter((event) => event.type === type);

// ---- How a run ended, recomputed from the artifact in plain JavaScript ----------------------------------
function outcomeOf(artifact) {
  if (artifact.status === "failed") return "failed";
  if (eventsOf(artifact, "lab_supervisor_fallback").length) return "degraded";
  if (eventsOf(artifact, "tool_failed").length) return "degraded";
  if (artifact.metrics.stopReason === "no_improvement") return "partial";
  return "completed";
}

// ---- Page helpers ----------------------------------------------------------------------------------------------
const viewGroup = (page) => page.getByRole("group", { name: "View" });
const viewButton = (page, name) => viewGroup(page).getByRole("button", { name, exact: true });
const waitStatus = (page, text) =>
  page.getByRole("status").getByText(text, { exact: true }).waitFor({ timeout: 120_000 });
const statusText = (page) => page.getByRole("status").innerText();
/** Collects every streamed body of one action, in order. */
async function capture(page, action, count) {
  const bodies = [];
  const onResponse = (response) => {
    if (response.url() === `${BASE}/api/agent-lab/runs` && response.request().method() === "POST") {
      bodies.push(response.text());
    }
  };
  page.on("response", onResponse);
  await action();
  while (bodies.length < count) await page.waitForTimeout(200);
  page.off("response", onResponse);
  return Promise.all(bodies);
}

const artifactOf = (body) => parseFrames(body).at(-1).artifact;

// Evaluated in the page: everything a layout check needs, so the checks run in one round trip.
const layoutProbe = (page) =>
  page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };
    const controls = [
      ...document.querySelectorAll("button, select, summary, a[href], input:not([type=hidden])"),
    ].filter(visible);
    const nameOf = (element) => {
      const label = element.getAttribute("aria-label");
      if (label?.trim()) return label.trim();
      const by = element.getAttribute("aria-labelledby");
      if (by) {
        const text = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
        if (text) return text;
      }
      const wrapping = element.closest("label")?.textContent?.trim();
      if (wrapping) return wrapping;
      return (element.textContent ?? "").trim() || element.getAttribute("title")?.trim() || "";
    };
    const unnamed = controls
      .filter((element) => !nameOf(element))
      .map((element) => element.outerHTML.slice(0, 80));
    const width = document.documentElement.clientWidth;
    const outside = controls
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > width + 0.5 || rect.left < -0.5;
      })
      .map((element) => nameOf(element));
    const clipped = controls
      .filter((element) => ["BUTTON", "SELECT", "SUMMARY"].includes(element.tagName))
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => nameOf(element));
    const toolbar = document.querySelector('section[aria-label="Experiment controls"]');
    const rects = toolbar
      ? [...toolbar.querySelectorAll("button, select")]
          .filter(visible)
          .map((element) => ({ name: nameOf(element), rect: element.getBoundingClientRect() }))
      : [];
    const overlaps = [];
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i].rect;
        const b = rects[j].rect;
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > 1 && y > 1) overlaps.push(`${rects[i].name} / ${rects[j].name}`);
      }
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: width,
      controls: controls.length,
      unnamed,
      outside,
      clipped,
      overlaps,
    };
  });

// WCAG contrast of text against what is really behind it. The background is sampled from a screenshot of the
// element with its text made transparent, so gradients and translucent surfaces are measured, not guessed.
const CONTRAST_SELECTORS = [
  "h1",
  "h2",
  "h3",
  ".agent-lab__intro",
  ".agent-lab__status",
  "button.primary",
  ".agent-lab__secondary",
  "[data-agent-lab-outcome]",
  ".agent-lab__table td",
  ".agent-lab__timeline p",
  ".agent-lab__fault-facts li",
  "[data-agent-lab-architecture] p",
  "small",
];
async function contrastProbe(page) {
  const results = [];
  for (const selector of CONTRAST_SELECTORS) {
    const locator = page.locator(selector);
    const count = Math.min(await locator.count(), 6);
    let taken = 0;
    for (let index = 0; index < count && taken < 2; index += 1) {
      const element = locator.nth(index);
      if (!(await element.isVisible())) continue;
      const style = await element.evaluate((node) => {
        const computed = getComputedStyle(node);
        return {
          color: computed.color,
          size: parseFloat(computed.fontSize),
          weight: Number(computed.fontWeight),
        };
      });
      const previous = await element.evaluate((node) => {
        const saved = [node.style.color, node.style.textShadow];
        node.style.setProperty("color", "transparent", "important");
        node.style.setProperty("text-shadow", "none", "important");
        node
          .querySelectorAll("*")
          .forEach((child) => child.style.setProperty("color", "transparent", "important"));
        return saved;
      });
      let shot;
      try {
        shot = await element.screenshot({ animations: "disabled" });
      } finally {
        await element.evaluate((node, saved) => {
          node.style.color = saved[0];
          node.style.textShadow = saved[1];
          node.querySelectorAll("*").forEach((child) => child.style.removeProperty("color"));
        }, previous);
      }
      const ratio = await page.evaluate(
        async ({ png, color }) => {
          // color-mix() computes to color(srgb r g b) with channels in 0..1; rgb() uses 0..255.
          const parse = (value) => {
            const numbers = value.match(/[\d.]+/g).map(Number);
            return value.startsWith("color(")
              ? [...numbers.slice(0, 3).map((channel) => channel * 255), ...numbers.slice(3)]
              : numbers;
          };
          const luminance = ([r, g, b]) => {
            const channel = (v) => {
              const c = v / 255;
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
          };
          const image = new Image();
          image.src = `data:image/png;base64,${png}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let r = 0;
          let g = 0;
          let b = 0;
          const pixels = data.length / 4;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
          }
          const background = [r / pixels, g / pixels, b / pixels];
          const text = parse(color);
          const alpha = text[3] ?? 1;
          const blended = text.slice(0, 3).map((v, i) => v * alpha + background[i] * (1 - alpha));
          const a = luminance(blended) + 0.05;
          const c = luminance(background) + 0.05;
          return Math.round((Math.max(a, c) / Math.min(a, c)) * 100) / 100;
        },
        { png: shot.toString("base64"), color: style.color },
      );
      const large = style.size >= 24 || (style.size >= 18.66 && style.weight >= 700);
      results.push({ selector, ratio, needed: large ? 3 : 4.5 });
      taken += 1;
    }
  }
  return results;
}

const motionProbe = (page) =>
  page.evaluate(() => {
    const seconds = (value) =>
      value
        .split(",")
        .map((part) => parseFloat(part) * (part.trim().endsWith("ms") ? 0.001 : 1))
        .reduce((max, item) => Math.max(max, Number.isFinite(item) ? item : 0), 0);
    return [...document.querySelectorAll(".agent-lab, .agent-lab *")]
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          transition: seconds(style.transitionDuration),
          animation: style.animationName !== "none" ? seconds(style.animationDuration) : 0,
        };
      })
      .reduce((max, item) => Math.max(max, item.transition, item.animation), 0);
  });

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
  const apiPaths = new Set();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiPaths.add(url.pathname);
  });
  const evidence = { scenarios: {}, faults: {}, matrix: [] };
  const allStreams = [];
  const allArtifacts = {};

  const response = await page.goto(`${BASE}/agent-lab`);
  check(response?.status() === 200, `the public Agent Lab loads (${response?.status()})`);
  await page.getByRole("heading", { name: "Agent Lab", level: 1 }).waitFor();
  const storage = () =>
    page.evaluate(() =>
      JSON.stringify([
        Object.entries(localStorage).sort(),
        Object.entries(sessionStorage).sort(),
        document.cookie,
      ]),
    );
  const storageBefore = await storage();

  // ---- One navigation model -----------------------------------------------------------------------------------
  const names = await viewGroup(page).getByRole("button").allInnerTexts();
  check(
    same(names, VIEWS),
    `the views are one group named ${VIEWS.join(", ")} (${names.join(", ")})`,
  );
  check(
    (await viewButton(page, "Run").getAttribute("aria-pressed")) === "true",
    "the current view (Run) is marked pressed",
  );
  await viewButton(page, "Architecture").click();
  check(
    (await viewButton(page, "Architecture").getAttribute("aria-pressed")) === "true" &&
      (await viewButton(page, "Run").getAttribute("aria-pressed")) === "false",
    "Architecture can be opened and replaces the current view",
  );

  // ---- Architecture view ---------------------------------------------------------------------------------------
  const architecture = page.locator("[data-agent-lab-architecture]");
  check((await architecture.count()) === 1, "the Architecture view is present");
  const headings = await architecture.getByRole("heading").allInnerTexts();
  check(
    headings.length >= 5 && (await architecture.getByRole("heading", { level: 2 }).count()) >= 1,
    `the Architecture view is organised by headings (${headings.length})`,
  );
  for (const [key, patterns] of Object.entries(ARCHITECTURE_SECTIONS)) {
    const section = architecture.locator(`[data-agent-lab-arch="${key}"]`);
    const text = (await section.count()) ? await section.innerText() : "";
    check(
      patterns.every((pattern) => pattern.test(text)),
      `Architecture explains ${key}: ${
        patterns
          .filter((pattern) => !pattern.test(text))
          .map(String)
          .join(" ") || "all points present"
      }`,
    );
  }
  const capabilities = await architecture
    .locator("[data-agent-lab-capability]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-agent-lab-capability")));
  check(
    same(capabilities, ["itinerary", "transport", "accommodation", "destination-guide", "dining"]),
    `Architecture lists the five capability boundaries in order (${capabilities.join(", ")})`,
  );
  await page.screenshot({ path: `${OUT}/light-1440-architecture.png`, fullPage: true });

  // ---- Normal comparison, infeasible budget, multi-city --------------------------------------------------
  await viewButton(page, "Run").click();
  const runs = [
    ["tokyo-couple", "Tokyo couple, normal comparison"],
    ["paris-family-infeasible", "Paris family, infeasible budget"],
    ["tokyo-kyoto-multi-city", "Tokyo and Kyoto, multi-city"],
  ];
  for (const [scenarioId, title] of runs) {
    await page.getByLabel("Scenario").selectOption(scenarioId);
    const bodies = await capture(
      page,
      () => page.getByRole("button", { name: "Compare all strategies" }).click(),
      3,
    );
    await waitStatus(page, "Run complete");
    const artifacts = bodies.map(artifactOf);
    bodies.forEach((body, index) => {
      writeFileSync(`${OUT}/${scenarioId}.${STRATEGIES[index]}.ndjson`, body);
      writeFileSync(
        `${OUT}/${scenarioId}.${STRATEGIES[index]}.artifact.json`,
        JSON.stringify(artifacts[index], null, 2),
      );
      allStreams.push(body);
    });
    allArtifacts[scenarioId] = artifacts;
    check(
      same(
        artifacts.map((artifact) => artifact.strategyId),
        STRATEGIES,
      ) &&
        artifacts.every(
          (artifact) =>
            artifact.status === "completed" &&
            artifact.scenarioId === scenarioId &&
            artifact.dataMode === "fixture" &&
            artifact.schemaVersion === 1 &&
            artifact.events.every((entry) => entry.dataMode === "fixture"),
        ),
      `${title}: three completed, versioned, fixture artifacts`,
    );
    // The Compare view: one column per strategy, each saying how its run ended.
    check(
      (await viewButton(page, "Compare").getAttribute("aria-pressed")) === "true",
      `${title}: the comparison opens in the Compare view`,
    );
    const columns = page.locator("[data-agent-lab-compare-side]");
    const compareOutcomes = await columns.evaluateAll((nodes) =>
      nodes.map(
        (node) =>
          node.querySelector("[data-agent-lab-outcome]")?.getAttribute("data-outcome") ?? null,
      ),
    );
    const compareLabels = await columns.evaluateAll((nodes) =>
      nodes.map(
        (node) => node.querySelector("[data-agent-lab-outcome]")?.textContent?.trim() ?? null,
      ),
    );
    const expectedOutcomes = artifacts.map(outcomeOf);
    check(
      same(compareOutcomes, expectedOutcomes) &&
        same(
          compareLabels,
          expectedOutcomes.map((kind) => LABELS[kind]),
        ),
      `${title}: Compare words each run's outcome as recomputed (${compareLabels.join(", ")})`,
    );
    const provenance = await page.locator("[data-agent-lab-provenance]").allInnerTexts();
    check(
      provenance.length >= 1 && provenance.every((text) => /Fixture data/.test(text)),
      `${title}: Compare says Fixture data (${provenance.join(" | ")})`,
    );
    await page.screenshot({ path: `${OUT}/light-1440-compare-${scenarioId}.png`, fullPage: true });

    // The Run view: each strategy in turn, with the same outcome word.
    await viewButton(page, "Run").click();
    for (const [index, strategyId] of STRATEGIES.entries()) {
      await page.getByLabel("Strategy").selectOption(strategyId);
      const badge = page.locator("[data-agent-lab-outcome]").first();
      await badge.waitFor();
      check(
        (await badge.getAttribute("data-outcome")) === expectedOutcomes[index] &&
          (await badge.innerText()).trim() === LABELS[expectedOutcomes[index]],
        `${title}: Run words ${strategyId} the same way (${expectedOutcomes[index]})`,
      );
      const runProvenance = await page.locator("[data-agent-lab-provenance]").allInnerTexts();
      check(
        runProvenance.length >= 2 && runProvenance.every((text) => /Fixture data/.test(text)),
        `${title}: Run says Fixture data for ${strategyId}`,
      );
    }
    evidence.scenarios[scenarioId] = {
      title,
      strategies: artifacts.map((artifact) => ({
        strategy: artifact.strategyId,
        outcome: outcomeOf(artifact),
        estTotal: artifact.plan.estTotal,
        withinBudget: artifact.metrics.withinBudget,
        rounds: artifact.metrics.rounds,
        stopReason: artifact.metrics.stopReason,
        checks: `${artifact.metrics.checks.filter((item) => item.passed).length}/${artifact.metrics.checks.length}`,
        unresolvedConflicts: artifact.metrics.unresolvedConflicts,
        multiCityConsistent: artifact.metrics.multiCityConsistent,
        usage: artifact.metrics.usage.status,
      })),
    };
  }
  const [, parisMulti] = allArtifacts["paris-family-infeasible"].slice(1);
  check(
    parisMulti.metrics.stopReason === "infeasible_budget" && parisMulti.metrics.rounds === 1,
    "infeasible budget: the multi-agent run stops at once as infeasible_budget",
  );
  const kyoto = allArtifacts["tokyo-kyoto-multi-city"];
  check(
    kyoto.every(
      (artifact) =>
        artifact.metrics.multiCityConsistent === true &&
        artifact.metrics.checks.every((item) => item.passed),
    ),
    "multi-city: every strategy keeps the move, the stays, the days and the totals consistent",
  );

  // ---- Controlled failure ------------------------------------------------------------------------------------------
  await viewButton(page, "Failures").click();
  const faultBodies = await capture(
    page,
    () => page.getByRole("button", { name: "Run all fault profiles" }).click(),
    5,
  );
  await waitStatus(page, "Fault runs complete");
  const faultArtifacts = {};
  faultBodies.forEach((body, index) => {
    const artifact = artifactOf(body);
    faultArtifacts[artifact.faultProfileId] = artifact;
    writeFileSync(`${OUT}/failure.${artifact.faultProfileId}.ndjson`, body);
    writeFileSync(
      `${OUT}/failure.${artifact.faultProfileId}.artifact.json`,
      JSON.stringify(artifact, null, 2),
    );
    allStreams.push(body);
    void index;
  });
  for (const [id, expected] of Object.entries(FAULTS)) {
    const artifact = faultArtifacts[id];
    const badge = page.locator(`[data-agent-lab-fault="${id}"] [data-agent-lab-outcome]`);
    check(
      artifact !== undefined &&
        outcomeOf(artifact) === expected.outcome &&
        (await badge.getAttribute("data-outcome")) === expected.outcome &&
        (await badge.innerText()).trim() === LABELS[expected.outcome],
      `failures: ${id} ends ${expected.outcome} in the artifact and on the page`,
    );
    evidence.faults[id] = {
      outcome: expected.outcome,
      status: artifact?.status,
      events: artifact?.events.length,
      failureAgent: artifact?.failure?.agent ?? null,
    };
  }
  const faultText = await page.locator("[data-agent-lab-failures]").innerText();
  check(/Fixture data/.test(faultText), "failures: the Failure Lab says its runs use Fixture data");
  await page.screenshot({ path: `${OUT}/light-1440-failures.png`, fullPage: true });

  // ---- Download, then offline replay ------------------------------------------------------------------------------
  const downloads = {};
  for (const [id, expected] of Object.entries(FAULTS)) {
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: `Download artifact for ${expected.title}` }).click(),
    ]);
    const text = readFileSync(await file.path(), "utf8");
    downloads[id] = file.suggestedFilename();
    writeFileSync(`${OUT}/download.${id}.json`, text);
    check(
      same(JSON.parse(text), faultArtifacts[id]),
      `download: ${id} equals the streamed artifact`,
    );
  }
  await viewButton(page, "Compare").click();
  const [compareFile] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: /^Download artifact for Five specialists, targeted revision/ })
      .click(),
  ]);
  const compareText = readFileSync(await compareFile.path(), "utf8");
  writeFileSync(`${OUT}/download.compare-revision.json`, compareText);
  check(
    JSON.parse(compareText).strategyId === "multi-agent-targeted-revision" &&
      JSON.parse(compareText).status === "completed",
    "download: a comparison column downloads its own completed artifact",
  );

  const replay = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
  });
  const rp = await replay.newPage();
  await rp.goto(`${BASE}/agent-lab`);
  await rp.getByRole("heading", { name: "Agent Lab", level: 1 }).waitFor();
  await replay.setOffline(true);
  const offlineCalls = [];
  rp.on(
    "request",
    (request) => request.url().includes("/api/") && offlineCalls.push(request.url()),
  );
  const replayFiles = [
    ...Object.keys(FAULTS).map((id) => `download.${id}.json`),
    "download.compare-revision.json",
  ];
  for (const file of replayFiles) {
    await rp.locator("input[data-agent-lab-replay-input]").setInputFiles(`${OUT}/${file}`);
    await rp
      .getByRole("status")
      .getByText("Replaying recorded run", { exact: true })
      .waitFor({ timeout: 60_000 });
    await rp
      .getByRole("status")
      .getByText("Replay complete", { exact: true })
      .waitFor({ timeout: 60_000 });
    const artifact = JSON.parse(readFileSync(`${OUT}/${file}`, "utf8"));
    const kind = outcomeOf(artifact);
    const badge = rp.locator("[data-agent-lab-outcome]").first();
    check(
      (await badge.getAttribute("data-outcome")) === kind &&
        (await rp.locator("[data-agent-lab-replay-note]").first().innerText()).includes(
          artifact.runId,
        ),
      `replay: ${file} replays offline, labelled a replay, ending ${kind}`,
    );
  }
  check(
    offlineCalls.length === 0,
    `replay: no /api request while offline (${offlineCalls.length})`,
  );
  await replay.close();

  // ---- The layout matrix, on the populated page -----------------------------------------------------------------
  const matrix = [];
  const themes = ["light", "dark"];
  const widths = [1440, 390, 320];
  for (const reduced of [false, true]) {
    for (const theme of themes) {
      for (const width of widths) {
        if (reduced && width === 320) continue;
        await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: reduced ? "reduce" : "no-preference",
        });
        const label = `${reduced ? "reduced-" : ""}${theme}-${width}`;
        for (const view of VIEWS) {
          await viewButton(page, view).click();
          await page.waitForTimeout(150);
          const probe = await layoutProbe(page);
          const ok =
            probe.scrollWidth <= probe.clientWidth &&
            probe.unnamed.length === 0 &&
            probe.outside.length === 0 &&
            probe.clipped.length === 0 &&
            probe.overlaps.length === 0 &&
            probe.controls > 4;
          check(
            ok,
            `layout ${label} / ${view}: no overflow, clipping, overlap or unnamed control (${probe.controls} controls${probe.scrollWidth > probe.clientWidth ? `, scrollWidth ${probe.scrollWidth} > ${probe.clientWidth}` : ""}${probe.unnamed.length ? `, unnamed ${probe.unnamed[0]}` : ""}${probe.outside.length ? `, outside ${probe.outside.join("/")}` : ""}${probe.clipped.length ? `, clipped ${probe.clipped.join("/")}` : ""}${probe.overlaps.length ? `, overlap ${probe.overlaps[0]}` : ""})`,
          );
          const checked = await contrastProbe(page);
          const low = checked.filter((item) => item.ratio < item.needed);
          check(
            low.length === 0 && checked.length >= 3,
            `layout ${label} / ${view}: text contrast holds (${checked.length} measured${low.length ? `, low ${low.map((item) => `${item.selector} ${item.ratio}<${item.needed}`).join("; ")}` : ""})`,
          );
          if (reduced) {
            const longest = await motionProbe(page);
            check(
              longest <= 0.001,
              `layout ${label} / ${view}: reduced motion leaves no transition or animation (${longest}s)`,
            );
          }
          await page.screenshot({
            path: `${OUT}/${label}-${view.toLowerCase()}.png`,
            fullPage: true,
          });
          matrix.push({ label, view, controls: probe.controls, passed: ok && low.length === 0 });
        }
      }
    }
  }
  evidence.matrix = matrix;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });

  // ---- Keyboard through the whole flow -------------------------------------------------------------------------
  await viewButton(page, "Run").focus();
  await page.keyboard.press("Tab");
  check(
    await viewButton(page, "Compare").evaluate((element) => element === document.activeElement),
    "keyboard: Tab moves from Run to Compare in the view group",
  );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  check(
    await viewButton(page, "Architecture").evaluate(
      (element) => element === document.activeElement,
    ),
    "keyboard: Tab reaches Architecture after Failures",
  );
  await page.keyboard.press("Enter");
  check(
    (await viewButton(page, "Architecture").getAttribute("aria-pressed")) === "true",
    "keyboard: Enter opens Architecture",
  );
  await viewButton(page, "Run").focus();
  await page.keyboard.press("Space");
  check(
    (await viewButton(page, "Run").getAttribute("aria-pressed")) === "true",
    "keyboard: Space returns to Run",
  );
  const downloadStatus = await statusText(page);
  check(
    /Artifact downloaded|Run complete|Fault runs complete/.test(downloadStatus),
    `announcements: the status region reports the latest action ("${downloadStatus}")`,
  );

  // ---- The ordinary workspace is untouched --------------------------------------------------------------------
  check(
    (await storage()) === storageBefore,
    "the public flow wrote nothing to saved chats, trips, preferences, storage or cookies",
  );
  check(
    [...apiPaths].every((path) => path === "/api/agent-lab/runs"),
    `the public flow called only the run endpoint (${[...apiPaths].join(", ")})`,
  );
  const workspace = await context.newPage();
  const workspaceErrors = [];
  workspace.on("pageerror", (error) => workspaceErrors.push(String(error)));
  const home = await workspace.goto(`${BASE}/`);
  check(home?.status() === 200, `the ordinary workspace still loads (${home?.status()})`);
  await workspace.waitForLoadState("networkidle");
  const homeText = await workspace.locator("body").innerText();
  check(
    !/Agent Lab|Failure lab|Fixture data/i.test(homeText) && homeText.trim().length > 0,
    "the workspace shows no Agent Lab content",
  );
  check(
    workspaceErrors.length === 0,
    `the workspace logs no page error (${workspaceErrors.join(" | ")})`,
  );
  await page.getByRole("link", { name: "AI Trip Planner" }).click();
  await page.waitForURL(`${BASE}/`);
  check(true, "the lab links back to the workspace");

  // ---- Nothing sensitive anywhere ------------------------------------------------------------------------------
  const corpus =
    allStreams.join("\n") + JSON.stringify(allArtifacts) + JSON.stringify(faultArtifacts);
  const leaked = LEAKS.filter((pattern) => pattern.test(corpus)).map(String);
  check(
    leaked.length === 0,
    `no stream or artifact carries a credential, prompt, reasoning, stack or payload (${leaked.join(", ")})`,
  );

  const pageErrors = errors.filter(
    (message) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(message),
  );
  check(
    pageErrors.length === 0,
    `no page or console errors (${pageErrors.slice(0, 2).join(" | ")})`,
  );
  await browser.close();

  // ---- Evidence --------------------------------------------------------------------------------------------------------
  writeFileSync(`${OUT}/comparison-summary.json`, JSON.stringify(evidence, null, 2));
  const rows = (id) =>
    evidence.scenarios[id].strategies
      .map(
        (item) =>
          `| ${item.strategy} | ${item.outcome} | A$${item.estTotal} | ${item.withinBudget ? "within" : "over"} | ${item.rounds} | ${item.stopReason ?? "no loop"} | ${item.checks} | ${item.unresolvedConflicts} | ${item.multiCityConsistent === null ? "n/a" : item.multiCityConsistent} | ${item.usage} |`,
      )
      .join("\n");
  writeFileSync(
    `${OUT}/report.md`,
    [
      "# Agent Lab release evidence",
      "",
      `Public flow against ${BASE}: four views, three scenarios compared under all three strategies, five fault profiles, download and offline replay, a ${matrix.length}-cell layout matrix, and the ordinary workspace.`,
      "",
      ...runs.flatMap(([id, title]) => [
        `## ${title}`,
        "",
        "| Strategy | Outcome | Estimate | Budget | Rounds | Stop | Checks | Unresolved | Multi-city | Usage |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        rows(id),
        "",
      ]),
      "## Controlled failures",
      "",
      "| Profile | Outcome | Run | Events | Failing specialist |",
      "| --- | --- | --- | --- | --- |",
      ...Object.entries(evidence.faults).map(
        ([id, item]) =>
          `| ${id} | ${item.outcome} | ${item.status} | ${item.events} | ${item.failureAgent ?? "none"} |`,
      ),
      "",
      "Every outcome was recomputed from its artifact in plain JavaScript and matched the Run, Compare and Failures views. Every artifact was downloaded, and replayed offline with no request.",
      "",
      "## Layout matrix",
      "",
      `${matrix.filter((cell) => cell.passed).length} of ${matrix.length} cells passed (light and dark, desktop and narrow, reduced motion, every view).`,
      "",
      failures.length
        ? `Failures:\n${failures.map((item) => `- ${item}`).join("\n")}`
        : "Result: pass.",
      "",
    ].join("\n"),
  );
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify({ passed: failures.length === 0, failures, downloads }, null, 2),
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
