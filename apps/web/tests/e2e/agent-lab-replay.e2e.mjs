import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(
  process.cwd(),
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/agent-lab-replay",
);
mkdirSync(OUT, { recursive: true });

const SCENARIO = "tokyo-couple-tight-budget";
const REVISION = "multi-agent-targeted-revision";
const MAX_BYTES = 5 * 1024 * 1024;
const CANARY = "SECRET-PROMPT-CANARY-8841";

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = (value) => JSON.parse(JSON.stringify(value));

const evidence = (page) =>
  page.evaluate(() => {
    const text = (node) => node.innerText.replace(/\s+/g, " ").trim();
    return {
      timeline: [...document.querySelectorAll("[data-agent-lab-event]")].map(text),
      summary: [...document.querySelectorAll(".agent-lab__plan-summary")].map(text),
      sections: [...document.querySelectorAll("[data-agent-lab-section]")].map(text),
      metrics: [...document.querySelectorAll(".agent-lab__metrics")].map(text),
      checks: [...document.querySelectorAll("[data-agent-lab-check]")].map(
        (item) => `${item.dataset.agentLabCheck}:${item.dataset.passed}`,
      ),
    };
  });

const statusText = (page) => page.getByRole("status").innerText();
const waitStatus = (page, text) =>
  page.getByRole("status").getByText(text, { exact: true }).waitFor({ timeout: 60_000 });
const replayInput = (page) => page.locator("input[data-agent-lab-replay-input]");
const replayError = (page) => page.locator("[data-agent-lab-replay-error]");

async function open(browser, { width, height, colorScheme = "light", tag }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  const response = await page.goto(`${BASE}/agent-lab`);
  check(response?.status() === 200, `${tag}: Agent Lab loads (${response?.status()})`);
  await page.getByRole("heading", { name: "Agent Lab", level: 1 }).waitFor();
  return { context, page, errors };
}

async function runStrategy(page, scenarioId, strategyId) {
  await page.getByLabel("Scenario").selectOption(scenarioId);
  await page.getByLabel("Strategy").selectOption(strategyId);
  const streamPromise = page.waitForResponse(
    (candidate) =>
      candidate.url() === `${BASE}/api/agent-lab/runs` && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Run experiment" }).click();
  const body = await (await streamPromise).text();
  await waitStatus(page, "Run complete");
  const frames = body
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { body, artifact: frames.at(-1).artifact };
}

async function download(page, name) {
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name }).click(),
  ]);
  const path = await file.path();
  return { filename: file.suggestedFilename(), text: readFileSync(path, "utf8") };
}

async function replayToEnd(page, file) {
  await replayInput(page).setInputFiles(file);
  await waitStatus(page, "Replaying recorded run");
  await waitStatus(page, "Replay complete");
}

const upload = (page, name, content) =>
  replayInput(page).setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.isBuffer(content) ? content : Buffer.from(content),
  });

async function main() {
  const browser = await chromium.launch({ channel: process.env.CHANNEL });
  const summary = { scenario: SCENARIO, strategy: REVISION, cases: [] };

  const original = await open(browser, { width: 1440, height: 1000, tag: "original" });
  const page = original.page;
  const storageKeys = () =>
    page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));

  check(
    (await page.getByRole("button", { name: /^Download artifact/ }).count()) === 0,
    "original: no download is offered before a run exists",
  );

  await page.getByLabel("Scenario").selectOption(SCENARIO);
  await page.getByLabel("Strategy").selectOption(REVISION);
  await page.getByRole("button", { name: "Run experiment" }).click();
  await page.getByRole("button", { name: "Cancel run" }).waitFor();
  check(
    (await page.getByRole("button", { name: /^Download artifact/ }).count()) === 0,
    "original: no download is offered while the run is still going",
  );
  check(
    await replayInput(page).isDisabled(),
    "original: replay cannot be started while a live run is going",
  );
  await page.getByRole("button", { name: "Cancel run" }).click();
  await waitStatus(page, "Run cancelled");
  check(
    (await page.getByRole("button", { name: /^Download artifact/ }).count()) === 0,
    "original: a cancelled run offers no download",
  );

  const storageBefore = await storageKeys();
  const run = await runStrategy(page, SCENARIO, REVISION);
  writeFileSync(`${OUT}/original.ndjson`, run.body);
  const strategyLabel = await page
    .getByLabel("Strategy")
    .locator(`option[value="${REVISION}"]`)
    .innerText();
  const downloadName = `Download artifact for ${strategyLabel}`;
  const originalEvidence = await evidence(page);
  writeFileSync(`${OUT}/original.evidence.json`, JSON.stringify(originalEvidence, null, 2));
  await page.screenshot({ path: `${OUT}/desktop-original.png`, fullPage: true });

  const downloaded = await download(page, downloadName);
  writeFileSync(`${OUT}/original.artifact.json`, downloaded.text);
  const artifact = JSON.parse(downloaded.text);
  check(
    downloaded.filename ===
      `agent-lab-${SCENARIO}-${REVISION}-${run.artifact.runId.replace(/[^a-z0-9_-]/gi, "-")}.json`,
    `original: download is named for scenario, strategy and run (${downloaded.filename})`,
  );
  check(artifact.schemaVersion === 1, "original: downloaded artifact is versioned 1");
  check(
    same(artifact, run.artifact),
    "original: downloaded artifact equals the artifact the stream completed with",
  );
  check(
    artifact.status === "completed" &&
      artifact.scenarioId === SCENARIO &&
      artifact.strategyId === REVISION &&
      artifact.dataMode === "fixture",
    "original: artifact names scenario, strategy, data mode and completed status",
  );
  check(
    typeof artifact.versions?.fixture === "string" &&
      typeof artifact.versions?.evaluator === "string",
    "original: artifact carries fixture and evaluator version metadata",
  );
  check(
    artifact.events.length > 0 && artifact.metrics.eventCount === artifact.events.length,
    `original: artifact records ${artifact.events.length} ordered events`,
  );
  const serialized = downloaded.text;
  check(
    !/"(prompt|systemPrompt|rawPrompt|chainOfThought|reasoning|apiKey|secret|authorization|password)"\s*:/i.test(
      serialized,
    ) && !/(sk-[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,}|Bearer\s)/.test(serialized),
    "original: artifact has no credential, raw prompt or chain-of-thought field",
  );
  check(
    (await statusText(page)).includes(`Artifact downloaded: ${downloaded.filename}`),
    "original: the download is announced in the status region",
  );

  const downloadButton = page.getByRole("button", { name: downloadName });
  await downloadButton.focus();
  const [keyboardDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.keyboard.press("Enter"),
  ]);
  check(
    keyboardDownload.suggestedFilename() === downloaded.filename,
    "original: Enter on the focused download button downloads the artifact",
  );

  await page.getByRole("button", { name: "Compare all strategies" }).focus();
  await page.keyboard.press("Tab");
  check(
    await page
      .getByRole("button", { name: "Replay artifact" })
      .evaluate((element) => element === document.activeElement),
    "original: Tab from Compare all strategies reaches Replay artifact",
  );
  const chooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const chooser = await chooserPromise;
  check(chooser.isMultiple() === false, "original: the chooser takes one artifact file");
  await chooser.setFiles(`${OUT}/original.artifact.json`);
  await waitStatus(page, "Replaying recorded run");
  check(
    await page
      .getByRole("button", { name: "Stop replay" })
      .evaluate((element) => element === document.activeElement),
    "original: keyboard focus stays on the same button when the replay starts",
  );
  await waitStatus(page, "Replay complete");
  check(
    same(await evidence(page), originalEvidence),
    "original: replaying over a live result on the same page reproduces it",
  );

  await page.getByRole("button", { name: "Compare all strategies" }).click();
  await waitStatus(page, "Run complete");
  const sideDownloads = page.getByRole("button", { name: /^Download artifact for / });
  check(
    (await sideDownloads.count()) === 3,
    `compare: each completed strategy offers a download (${await sideDownloads.count()})`,
  );
  const compared = [];
  for (let index = 0; index < 3; index += 1) {
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      sideDownloads.nth(index).click(),
    ]);
    const text = readFileSync(await file.path(), "utf8");
    compared.push(JSON.parse(text));
    writeFileSync(`${OUT}/compare.${index + 1}.artifact.json`, text);
  }
  check(
    same(
      compared.map((item) => item.strategyId),
      ["single-agent-baseline", "multi-agent-no-revision", REVISION],
    ),
    "compare: the three downloads name the three strategies in order",
  );
  check(
    compared.every((item) => item.scenarioId === SCENARIO && item.status === "completed"),
    "compare: every download is a completed artifact of the selected scenario",
  );
  await original.context.close();

  const replay = await open(browser, { width: 1440, height: 1000, tag: "replay" });
  const replayPage = replay.page;
  const requests = [];
  const failedRequests = [];
  await replay.context.setOffline(true);
  replayPage.on("request", (request) => requests.push(request.url()));
  replayPage.on("requestfailed", (request) => failedRequests.push(request.url()));
  await replayPage.evaluate(() => {
    window.__arrivals = [];
    let seen = 0;
    new MutationObserver(() => {
      const count = document.querySelectorAll("[data-agent-lab-event]").length;
      while (seen < count) {
        window.__arrivals.push(performance.now());
        seen += 1;
      }
      if (count < seen) seen = count;
    }).observe(document.body, { childList: true, subtree: true });
  });
  const replayStorageBefore = await replayPage.evaluate(() =>
    JSON.stringify(Object.entries(localStorage).sort()),
  );

  await replayInput(replayPage).setInputFiles(`${OUT}/original.artifact.json`);
  await waitStatus(replayPage, "Replaying recorded run");
  check(
    await replayPage.getByRole("button", { name: "Run experiment" }).isDisabled(),
    "replay: Run experiment is disabled while a replay plays",
  );
  check(
    await replayInput(replayPage).isDisabled(),
    "replay: a second file cannot be chosen mid-replay",
  );
  check(
    (await replayPage.getByRole("button", { name: "Stop replay" }).count()) === 1,
    "replay: Stop replay is offered while a replay plays",
  );
  check(
    (await replayPage.locator("[data-agent-lab-section]").count()) === 0,
    "replay: no plan is shown before the recorded run completes",
  );
  await waitStatus(replayPage, "Replay complete");

  const replayedEvidence = await evidence(replayPage);
  writeFileSync(`${OUT}/replayed.evidence.json`, JSON.stringify(replayedEvidence, null, 2));
  check(
    same(replayedEvidence.timeline, originalEvidence.timeline),
    `replay: ${replayedEvidence.timeline.length} timeline events equal the original, in order`,
  );
  check(
    same(replayedEvidence.sections, originalEvidence.sections) &&
      same(replayedEvidence.summary, originalEvidence.summary),
    "replay: plan summary and sections equal the original",
  );
  check(
    same(replayedEvidence.metrics, originalEvidence.metrics) &&
      same(replayedEvidence.checks, originalEvidence.checks),
    "replay: metrics and named checks equal the original",
  );
  check(
    (await replayPage.getByLabel("Scenario").inputValue()) === SCENARIO &&
      (await replayPage.getByLabel("Strategy").inputValue()) === REVISION,
    "replay: the recorded scenario and strategy are selected",
  );
  const note = await replayPage.locator("[data-agent-lab-replay-note]").innerText();
  check(
    note.includes(artifact.runId) && /replay/i.test(note),
    "replay: the page says this is a replay and names the recorded run",
  );
  check(
    (await replayPage.getByRole("button", { name: "Stop replay" }).count()) === 0,
    "replay: Stop replay is gone once the replay completes",
  );

  const arrivals = await replayPage.evaluate(() => window.__arrivals);
  const recorded = artifact.events.map((event) => event.elapsedMs - artifact.events[0].elapsedMs);
  const observed = arrivals.map((time) => time - arrivals[0]);
  const drift = observed.map((time, index) => Math.round(time - recorded[index]));
  writeFileSync(
    `${OUT}/replay.timing.json`,
    JSON.stringify({ recorded, observed: observed.map(Math.round), drift }, null, 2),
  );
  check(
    arrivals.length === artifact.events.length,
    `replay: ${arrivals.length} events arrived one by one (${artifact.events.length} recorded)`,
  );
  check(
    drift.every((value) => Math.abs(value) <= 300),
    `replay: every event arrives within 300 ms of its recorded offset (max drift ${Math.max(...drift.map(Math.abs))} ms)`,
  );
  check(
    recorded.at(-1) < 300 || observed.at(-1) >= recorded.at(-1) * 0.8,
    `replay: the replay is not faster than recorded (${Math.round(observed.at(-1))} of ${recorded.at(-1)} ms)`,
  );

  const apiRequests = requests.filter((url) => url.includes("/api/"));
  check(apiRequests.length === 0, `replay: no /api request while offline (${apiRequests.length})`);
  check(
    failedRequests.length === 0,
    `replay: no request failed while offline (${failedRequests.length}: ${failedRequests.slice(0, 3).join(", ")})`,
  );
  check(
    (await replayPage.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()))) ===
      replayStorageBefore && replayStorageBefore === storageBefore,
    "replay: saved chats, trips and preferences are untouched",
  );
  await replayPage.screenshot({ path: `${OUT}/desktop-replay.png`, fullPage: true });
  await replayPage.emulateMedia({ colorScheme: "dark" });
  await replayPage.screenshot({ path: `${OUT}/desktop-replay-dark.png`, fullPage: true });
  await replayPage.emulateMedia({ colorScheme: "light" });

  await replayInput(replayPage).setInputFiles(`${OUT}/original.artifact.json`);
  await replayPage.getByRole("button", { name: "Stop replay" }).waitFor();
  await replayPage.waitForFunction(
    () => document.querySelectorAll("[data-agent-lab-event]").length >= 3,
  );
  await replayPage.getByRole("button", { name: "Stop replay" }).click();
  await waitStatus(replayPage, "Replay stopped");
  const stopped = await evidence(replayPage);
  check(
    stopped.sections.length === 0 &&
      stopped.timeline.length > 0 &&
      stopped.timeline.length < artifact.events.length,
    `replay: stopping keeps the ${stopped.timeline.length} events seen and shows no plan`,
  );
  check(
    (await replayPage.getByRole("button", { name: "Run experiment" }).isEnabled()) &&
      (await replayInput(replayPage).isEnabled()),
    "replay: controls are usable again after Stop replay",
  );

  for (const item of compared) {
    await replayToEnd(replayPage, {
      name: `${item.strategyId}.json`,
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(item)),
    });
    const seen = await evidence(replayPage);
    check(
      seen.timeline.length === item.events.length &&
        seen.sections.length === item.plan.sections.length &&
        (await replayPage.getByLabel("Strategy").inputValue()) === item.strategyId,
      `replay: ${item.strategyId} replays ${item.events.length} events and ${item.plan.sections.length} sections`,
    );
  }

  const base = artifact;
  const cases = [];
  const mutate = (name, phrases, build) => cases.push({ name, phrases, build });
  mutate("not-json", ["not valid JSON"], () => "this is not json{");
  mutate("empty-file", ["not valid JSON"], () => "");
  mutate("not-an-artifact", ["not an Agent Lab artifact"], () => JSON.stringify({ hello: 1 }));
  mutate("no-version", ["not an Agent Lab artifact"], () => {
    const copy = clone(base);
    delete copy.schemaVersion;
    return JSON.stringify(copy);
  });
  mutate("unsupported-version", ["schema version 2", "replays version 1"], () =>
    JSON.stringify({ ...clone(base), schemaVersion: 2 }),
  );
  mutate("missing-event", ["missing, duplicated or out of order", "event 4"], () => {
    const copy = clone(base);
    copy.events.splice(3, 1);
    return JSON.stringify(copy);
  });
  mutate("duplicated-event", ["missing, duplicated or out of order"], () => {
    const copy = clone(base);
    copy.events.splice(2, 0, copy.events[2]);
    return JSON.stringify(copy);
  });
  mutate("reordered-events", ["missing, duplicated or out of order"], () => {
    const copy = clone(base);
    [copy.events[4], copy.events[5]] = [copy.events[5], copy.events[4]];
    return JSON.stringify(copy);
  });
  mutate("timed-backwards", ["timed before"], () => {
    const copy = clone(base);
    copy.events[5].elapsedMs = Math.max(0, copy.events[4].elapsedMs - 50);
    return JSON.stringify(copy);
  });
  mutate("other-run-event", ["different run, scenario, strategy or data mode"], () => {
    const copy = clone(base);
    copy.events[2].runId = "some-other-run";
    return JSON.stringify(copy);
  });
  mutate("event-count", ["metrics.eventCount"], () => {
    const copy = clone(base);
    copy.metrics.eventCount += 1;
    return JSON.stringify(copy);
  });
  mutate("broken-plan", ["plan.sections"], () => {
    const copy = clone(base);
    delete copy.plan.sections;
    return JSON.stringify(copy);
  });
  mutate("unknown-scenario", ["scenarioId"], () =>
    JSON.stringify({ ...clone(base), scenarioId: "atlantis-honeymoon" }),
  );
  mutate("empty-trace", ["contain events"], () => {
    const copy = clone(base);
    copy.events = [];
    copy.metrics.eventCount = 0;
    return JSON.stringify(copy);
  });

  mutate("failed-run-without-events", ["no events to replay"], () => {
    const copy = clone(base);
    delete copy.plan;
    return JSON.stringify({
      ...copy,
      status: "failed",
      events: [],
      failure: { code: "run_failed", message: "recorded failure", atSequence: 0 },
      metrics: { eventCount: 0, durationMs: base.metrics.durationMs },
    });
  });
  mutate("endless-trace", ["longer than 10 minutes"], () => {
    const copy = clone(base);
    copy.events.at(-1).elapsedMs = 3_600_000;
    return JSON.stringify(copy);
  });
  mutate("oversized", ["larger than 5 MB"], () => Buffer.alloc(MAX_BYTES + 1, " "));

  const fresh = await open(browser, { width: 1440, height: 1000, tag: "reject" });
  for (const item of cases) {
    await upload(fresh.page, `${item.name}.json`, item.build());
    await replayError(fresh.page).waitFor();
    const message = await replayError(fresh.page).innerText();
    const shown = await evidence(fresh.page);
    const status = await statusText(fresh.page);
    const ok =
      item.phrases.every((phrase) => message.toLowerCase().includes(phrase.toLowerCase())) &&
      shown.timeline.length === 0 &&
      shown.sections.length === 0 &&
      status.includes("Replay failed");
    check(ok, `reject: ${item.name} is refused with its reason (${message.slice(0, 110)})`);
    summary.cases.push({ name: item.name, rejected: ok, message });
    await fresh.page.evaluate(() => {
      const input = document.querySelector("input[data-agent-lab-replay-input]");
      if (input) input.value = "";
    });
  }
  check(
    (await fresh.page.getByRole("alert").filter({ hasText: "Replay" }).count()) <= 1,
    "reject: the rejection is a single alert, not a stack of them",
  );
  writeFileSync(`${OUT}/rejections.json`, JSON.stringify(summary.cases, null, 2));
  await fresh.page.screenshot({ path: `${OUT}/desktop-rejected.png`, fullPage: true });
  await fresh.context.close();

  const keep = await open(browser, { width: 1440, height: 1000, tag: "keep" });
  await runStrategy(keep.page, "tokyo-couple", "single-agent-baseline");
  const before = await evidence(keep.page);
  await upload(keep.page, "bad.json", "not json");
  await replayError(keep.page).waitFor();
  check(
    same(await evidence(keep.page), before),
    "reject: a rejected file leaves the result already on the page untouched",
  );
  await upload(keep.page, "good.json", JSON.stringify(compared[0]));
  await waitStatus(keep.page, "Replaying recorded run");
  await waitStatus(keep.page, "Replay complete");
  check(
    (await replayError(keep.page).count()) === 0,
    "reject: the rejection clears once a valid artifact replays",
  );
  await keep.context.close();

  const canary = clone(base);
  canary.systemPrompt = CANARY;
  canary.events[1].event.rawPrompt = CANARY;
  canary.plan.sections[0].internalNotes = CANARY;
  await replayToEnd(replayPage, {
    name: "canary.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(canary)),
  });
  check(
    !(await replayPage.content()).includes(CANARY),
    "replay: a raw prompt added to an uploaded file never reaches the page",
  );

  const phone = await open(browser, { width: 390, height: 844, tag: "phone" });
  await phone.context.setOffline(true);
  await upload(phone.page, "phone.json", readFileSync(`${OUT}/original.artifact.json`));
  await waitStatus(phone.page, "Replaying recorded run");
  await waitStatus(phone.page, "Replay complete");
  check(
    (await phone.page.evaluate(() => document.documentElement.scrollWidth)) === 390,
    "phone: no horizontal page scroll after a replay",
  );
  check(
    await phone.page.getByRole("button", { name: "Replay artifact" }).isVisible(),
    "phone: Replay artifact stays visible",
  );
  check(
    await phone.page.getByRole("button", { name: downloadName }).isVisible(),
    "phone: the download button is visible beside the metrics",
  );
  await phone.page.screenshot({ path: `${OUT}/phone-replay.png`, fullPage: true });

  const pageErrors = [
    ...original.errors,
    ...replay.errors,
    ...phone.errors,
    ...keep.errors,
    ...fresh.errors,
  ].filter((message) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(message));
  check(
    pageErrors.length === 0,
    `no page or console errors (${pageErrors.slice(0, 2).join(" | ")})`,
  );

  await browser.close();

  Object.assign(summary, {
    failures,
    passed: failures.length === 0,
    runId: artifact.runId,
    events: artifact.events.length,
    replayRequests: { api: apiRequests.length, failed: failedRequests.length },
  });
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  writeFileSync(
    `${OUT}/report.md`,
    [
      "# Agent Lab artifact download and offline replay",
      "",
      `Run \`${artifact.runId}\`: ${SCENARIO}, ${REVISION}, ${artifact.events.length} events.`,
      "",
      "- The downloaded artifact equals the artifact the stream completed with and names its schema version.",
      `- Replayed offline in a fresh page: ${replayedEvidence.timeline.length} events, plan, metrics and checks equal the original; ${apiRequests.length} API requests.`,
      `- Timing: every event within 300 ms of its recorded offset (drift ${drift.join(", ")} ms).`,
      `- ${summary.cases.filter((item) => item.rejected).length} of ${cases.length} invalid files were refused with a stated reason.`,
      "",
      "| Rejected file | Reason shown |",
      "| --- | --- |",
      ...summary.cases.map((item) => `| ${item.name} | ${item.message.replace(/\|/g, "/")} |`),
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
