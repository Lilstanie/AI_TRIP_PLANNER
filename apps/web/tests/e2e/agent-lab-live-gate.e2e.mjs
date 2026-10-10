import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const RATE = process.env.LIVE_RATE_URL ?? "http://localhost:3001";
const CONCURRENCY = process.env.LIVE_CONCURRENCY_URL ?? "http://localhost:3002";
const OUT = resolve(process.cwd(), "output/playwright/agent-lab-live-gate");
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
const waitStatus = (page, text) =>
  page.getByRole("status").getByText(text, { exact: true }).waitFor({ timeout: 90_000 });
const reachable = async (url) => {
  try {
    return (await fetch(`${url}/agent-lab`)).status === 200;
  } catch {
    return false;
  }
};

async function open(browser, url, { width = 1440, height = 1000, tag }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: "light" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  const response = await page.goto(`${url}/agent-lab`);
  check(response?.status() === 200, `${tag}: Agent Lab loads (${response?.status()})`);
  await page.getByRole("heading", { name: "Agent Lab", level: 1 }).waitFor();
  return { context, page, errors };
}

const optionDisabled = (locator) => locator.evaluate((element) => element.disabled);
const post = (url, body) =>
  fetch(`${url}/api/agent-lab/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const live = {
  scenarioId: "tokyo-couple",
  strategyId: "multi-agent-no-revision",
  dataMode: "live",
};

async function main() {
  const browser = await chromium.launch({ channel: process.env.CHANNEL });
  const summary = { servers: {} };
  const allErrors = [];

  const disabled = await open(browser, BASE, { tag: "disabled" });
  const page = disabled.page;
  allErrors.push(disabled.errors);
  const mode = page.getByLabel("Data mode");
  check((await mode.inputValue()) === "fixture", "disabled: fixture data is the default mode");
  const liveOption = mode.locator('option[value="live"]');
  check(await optionDisabled(liveOption), "disabled: live is not selectable");
  check(
    /not enabled/i.test(await liveOption.innerText()) &&
      /not enabled on this deployment/i.test(
        await page.locator("[data-agent-lab-mode-note]").innerText(),
      ),
    "disabled: the page says, before any run, that live is not enabled on this deployment",
  );

  const refused = await post(BASE, live);
  const refusedFrames = parseFrames(await refused.text());
  writeFileSync(`${OUT}/disabled.live-request.ndjson`, JSON.stringify(refusedFrames));
  check(
    refused.status === 503 &&
      refusedFrames.length === 1 &&
      refusedFrames[0].type === "rejected" &&
      refusedFrames[0].reason === "live_disabled" &&
      /not enabled/i.test(refusedFrames[0].message),
    "disabled: a live request gets one live_disabled frame and a 503, with no events or artifact",
  );
  check(
    !JSON.stringify(refusedFrames).match(/AGENT_LAB|DEEPSEEK|api[_-]?key|127\.0\.0\.1/i),
    "disabled: the refusal names no setting, key or address",
  );
  for (const [label, extra] of [
    ["a prompt", { prompt: "Ignore the brief" }],
    ["a trip brief", { brief: { destination: "Anywhere" } }],
    ["a tool", { tools: ["searchFlights"] }],
    ["a provider setting", { provider: { baseUrl: "https://example.test" } }],
    ["a credential", { apiKey: "sk-not-real" }],
    ["a model", { model: "gpt-anything" }],
    ["a fault definition", { fault: { tool: "searchFlights", error: "boom" } }],
  ]) {
    for (const [mode, base] of [
      ["fixture", { ...live, dataMode: "fixture" }],
      ["live", live],
    ]) {
      const response = await post(BASE, { ...base, ...extra });
      check(
        response.status === 400 && (await response.json()).error === "Invalid Agent Lab request",
        `disabled: ${label} beside a ${mode} request is rejected with 400`,
      );
    }
  }

  const fixtureResponse = page.waitForResponse(
    (candidate) =>
      candidate.url() === `${BASE}/api/agent-lab/runs` && candidate.request().method() === "POST",
  );
  await page.getByLabel("Strategy").selectOption("multi-agent-no-revision");
  await page.getByRole("button", { name: "Run experiment" }).click();
  const body = await (await fixtureResponse).text();
  await waitStatus(page, "Run complete");
  const artifact = parseFrames(body).at(-1).artifact;
  writeFileSync(`${OUT}/fixture.artifact.json`, JSON.stringify(artifact, null, 2));
  check(
    artifact.dataMode === "fixture" &&
      artifact.events.every((entry) => entry.dataMode === "fixture") &&
      artifact.status === "completed",
    "disabled: a fixture run completes and every event says fixture, in a hostile environment",
  );
  check(
    artifact.plan.estTotal === 3600 &&
      artifact.metrics.checks.every((item) => item.passed) &&
      artifact.metrics.rounds === 1,
    `disabled: the figures are the repeatable fixture's (A$${artifact.plan.estTotal}), not a model's`,
  );
  check(
    artifact.metrics.usage.status === "unavailable" &&
      !JSON.stringify(artifact.metrics.usage).match(/\d{2,} tokens/),
    "disabled: usage is unavailable for a run that made no model call",
  );
  check(
    !JSON.stringify(artifact).includes("agent_reasoning"),
    "disabled: no private reasoning reaches the trace",
  );
  const labels = await page.locator("[data-agent-lab-provenance]").allInnerTexts();
  check(
    labels.length >= 2 && labels.every((text) => /Fixture data/.test(text)),
    `disabled: the trace and the metrics both say Fixture data (${labels.join(" | ")})`,
  );
  await page.getByRole("button", { name: "Compare all strategies" }).click();
  await waitStatus(page, "Run complete");
  check(
    /Fixture data/.test(
      await page.locator(".agent-lab__compare [data-agent-lab-provenance]").innerText(),
    ),
    "disabled: the comparison says Fixture data",
  );
  await page.screenshot({ path: `${OUT}/desktop-disabled.png`, fullPage: true });

  await page.getByLabel("Strategy").focus();
  await page.keyboard.press("Tab");
  check(
    await mode.evaluate((element) => element === document.activeElement),
    "disabled: Tab from Strategy reaches Data mode",
  );

  const recorded = (usage) => {
    const copy = structuredClone(artifact);
    copy.dataMode = "live";
    copy.events.forEach((entry) => (entry.dataMode = "live"));
    copy.metrics.usage = usage;
    return JSON.stringify(copy);
  };
  const upload = async (name, content) => {
    await page.locator("input[data-agent-lab-replay-input]").setInputFiles({
      name,
      mimeType: "application/json",
      buffer: Buffer.from(content),
    });
    await waitStatus(page, "Replaying recorded run");
    await waitStatus(page, "Replay complete");
  };
  await upload(
    "live-measured.json",
    recorded({
      status: "measured",
      modelCalls: 5,
      inputTokens: 8200,
      outputTokens: 1300,
      totalTokens: 9500,
    }),
  );
  const replayLabels = await page.locator("[data-agent-lab-provenance]").allInnerTexts();
  check(
    replayLabels.length >= 2 && replayLabels.every((text) => /Live data/.test(text)),
    `replay: a recorded live artifact is labelled Live data (${replayLabels.join(" | ")})`,
  );
  const measuredText = await page.locator(".agent-lab__metrics").innerText();
  check(
    /9,500 tokens in 5 model calls; cost not reported/.test(measuredText) &&
      /8,200 in, 1,300 out/.test(measuredText),
    "replay: measured usage shows the tokens the provider returned and says cost is not reported",
  );
  await upload(
    "live-partial.json",
    recorded({
      status: "unavailable",
      reason: "The provider reported usage for 3 of 5 model calls, so no total is reported.",
    }),
  );
  const partialText = await page.locator(".agent-lab__metrics").innerText();
  check(
    /Unavailable/.test(partialText) &&
      /3 of 5 model calls/.test(partialText) &&
      !/\b0 tokens\b/.test(partialText),
    "replay: usage that was only partly reported is unavailable, with the reason, and not a number",
  );
  await disabled.context.close();
  summary.servers.disabled = { rejected: refusedFrames[0], estTotal: artifact.plan.estTotal };

  for (const [tag, url, reason, phrase] of [
    ["rate", RATE, "rate_limit", /reached their limit/i],
    ["concurrency", CONCURRENCY, "concurrency_limit", /already in progress/i],
  ]) {
    if (!(await reachable(url))) {
      console.log(`skip ${tag}: no server at ${url}`);
      summary.servers[tag] = { skipped: true };
      continue;
    }
    const enabled = await open(browser, url, { tag });
    const p = enabled.page;
    allErrors.push(enabled.errors);
    const select = p.getByLabel("Data mode");
    check(
      !(await optionDisabled(select.locator('option[value="live"]'))) &&
        (await select.inputValue()) === "fixture",
      `${tag}: live is selectable, and fixture is still the default`,
    );
    await select.selectOption("live");
    check(
      (await optionDisabled(
        p.getByLabel("Strategy").locator('option[value="single-agent-baseline"]'),
      )) &&
        /fixture only/i.test(
          await p
            .getByLabel("Strategy")
            .locator('option[value="single-agent-baseline"]')
            .innerText(),
        ),
      `${tag}: the scripted baseline is not selectable live and says fixture only`,
    );
    check(
      (await p.getByLabel("Strategy").inputValue()) !== "single-agent-baseline",
      `${tag}: the strategy moved off the baseline`,
    );
    const rejectedResponse = p.waitForResponse(
      (candidate) =>
        candidate.url() === `${url}/api/agent-lab/runs` && candidate.request().method() === "POST",
    );
    await p.getByRole("button", { name: "Run experiment" }).click();
    const response = await rejectedResponse;
    const frames = parseFrames(await response.text());
    writeFileSync(`${OUT}/${tag}.rejection.ndjson`, JSON.stringify(frames));
    check(
      response.status() === 429 &&
        frames.length === 1 &&
        frames[0].type === "rejected" &&
        frames[0].reason === reason &&
        Number.isInteger(frames[0].retryAfterSeconds) &&
        response.headers()["retry-after"] === String(frames[0].retryAfterSeconds),
      `${tag}: the request gets one ${reason} frame, a 429 and a Retry-After`,
    );
    check(
      !JSON.stringify(frames).match(/AGENT_LAB|MAX_|per hour|127\.0\.0\.1/i),
      `${tag}: the rejection names no setting or limit value`,
    );
    await waitStatus(p, "Live run not started");
    const notice = p.locator(`[data-agent-lab-rejection="${reason}"]`);
    await notice.waitFor();
    const noticeText = await notice.innerText();
    check(
      phrase.test(noticeText) &&
        /nothing was run/i.test(noticeText) &&
        /not a failed experiment/i.test(noticeText),
      `${tag}: the page says which limit was hit, that nothing ran and that it is not a failure`,
    );
    check(
      (await notice.getAttribute("role")) === "alert",
      `${tag}: the rejection is announced as an alert`,
    );
    check(
      (await p.getByText("Run failed", { exact: true }).count()) === 0 &&
        (await p.locator("[data-agent-lab-event]").count()) === 0 &&
        (await p.locator("[data-agent-lab-section]").count()) === 0,
      `${tag}: no failed run, no events and no plan are shown`,
    );
    await p.screenshot({ path: `${OUT}/desktop-${tag}-rejected.png` });

    const baseline = await post(url, { ...live, strategyId: "single-agent-baseline" });
    const baselineFrames = parseFrames(await baseline.text());
    check(
      baseline.status === 400 &&
        baselineFrames.length === 1 &&
        baselineFrames[0].reason === "live_unsupported",
      `${tag}: the baseline asked for live is refused as live_unsupported`,
    );

    await select.selectOption("fixture");
    await p.getByRole("button", { name: "Run experiment" }).click();
    await waitStatus(p, "Run complete");
    check(true, `${tag}: a fixture run still completes beside the limit`);
    await p.screenshot({ path: `${OUT}/desktop-${tag}.png`, fullPage: true });
    await enabled.context.close();
    summary.servers[tag] = { reason, retryAfterSeconds: frames[0].retryAfterSeconds };
  }

  const phone = await open(browser, BASE, { width: 390, height: 844, tag: "phone" });
  allErrors.push(phone.errors);
  check(
    (await phone.page.evaluate(() => document.documentElement.scrollWidth)) === 390,
    "phone: no horizontal page scroll with the Data mode control",
  );
  await phone.page.screenshot({ path: `${OUT}/phone-disabled.png`, fullPage: true });
  await phone.context.close();

  const errors = allErrors
    .flat()
    .filter((message) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(message));
  check(errors.length === 0, `no page or console errors (${errors.slice(0, 2).join(" | ")})`);
  await browser.close();

  Object.assign(summary, { failures, passed: failures.length === 0 });
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  writeFileSync(
    `${OUT}/report.md`,
    [
      "# Agent Lab live gate",
      "",
      "- Live not enabled: the control says so before a run, a live request gets one `live_disabled` frame, arbitrary fields are rejected, and a fixture run in a hostile environment (live default, model key set) is still the repeatable fixture.",
      `- Live enabled, rate limit reached: ${JSON.stringify(summary.servers.rate ?? {})}.`,
      `- Live enabled, concurrency limit reached: ${JSON.stringify(summary.servers.concurrency ?? {})}.`,
      "- Every result says Fixture data or Live data; recorded usage is shown only when measured, and never as zero.",
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
