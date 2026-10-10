import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(
  process.cwd(),
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/agent-lab-single-agent",
);
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

async function run(browser, { width, height, tag }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: "light" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

  const response = await page.goto(`${BASE}/agent-lab`);
  check(response?.status() === 200, `${tag}: public Agent Lab returns 200 (${response?.status()})`);
  check(new URL(page.url()).pathname === "/agent-lab", `${tag}: page is not redirected to sign-in`);
  await page.getByRole("heading", { name: "Agent Lab", level: 1 }).waitFor();

  const scenario = page.getByLabel("Scenario");
  const strategy = page.getByLabel("Strategy");
  check((await scenario.inputValue()) === "tokyo-couple", `${tag}: Tokyo scenario is selected`);
  check(
    (await strategy.inputValue()) === "single-agent-baseline",
    `${tag}: single-agent strategy is selected`,
  );
  check(
    (await page.getByText("Fixture data", { exact: true }).count()) >= 1,
    `${tag}: fixture provenance is visible`,
  );

  await scenario.focus();
  await page.keyboard.press("Tab");
  check(
    await strategy.evaluate((element) => element === document.activeElement),
    `${tag}: Tab reaches Strategy`,
  );
  await page.keyboard.press("Tab");
  check(
    await page.getByLabel("Data mode").evaluate((element) => element === document.activeElement),
    `${tag}: Tab reaches Data mode`,
  );
  await page.keyboard.press("Tab");
  check(
    await page
      .getByRole("button", { name: "Run experiment" })
      .evaluate((element) => element === document.activeElement),
    `${tag}: Tab reaches Run experiment`,
  );

  const workspaceStorage = () =>
    page.evaluate(() =>
      JSON.stringify({
        catalog: localStorage.getItem("trip-workspace-catalog-v3"),
        current: localStorage.getItem("trip-workspace-v1"),
      }),
    );
  const storageBefore = await workspaceStorage();

  await page.getByRole("button", { name: "Run experiment" }).click();
  const cancel = page.getByRole("button", { name: "Cancel run" });
  await cancel.waitFor();
  await cancel.click();
  await page.getByRole("status").getByText("Run cancelled", { exact: true }).waitFor();
  check(
    (await page.locator("[data-agent-lab-section]").count()) === 0,
    `${tag}: cancelled run has no completed plan`,
  );

  const streamPromise = page.waitForResponse(
    (candidate) =>
      candidate.url() === `${BASE}/api/agent-lab/runs` && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Run experiment" }).click();
  const stream = await streamPromise;
  const body = await stream.text();
  writeFileSync(`${OUT}/${tag}.ndjson`, body);
  const frames = parseFrames(body);
  const complete = frames.at(-1);

  await page.getByRole("status").getByText("Run complete", { exact: true }).waitFor();
  check(stream.status() === 200, `${tag}: stream returns 200 (${stream.status()})`);
  check(complete?.type === "complete", `${tag}: final frame is complete`);
  check(complete?.artifact?.schemaVersion === 1, `${tag}: artifact schema version is 1`);
  check(complete?.artifact?.scenarioId === "tokyo-couple", `${tag}: artifact names the scenario`);
  check(
    complete?.artifact?.strategyId === "single-agent-baseline",
    `${tag}: artifact names the strategy`,
  );
  check(complete?.artifact?.dataMode === "fixture", `${tag}: artifact records fixture mode`);
  check(complete?.artifact?.status === "completed", `${tag}: artifact is completed`);
  check(
    complete?.artifact?.plan?.sections?.length === 5,
    `${tag}: artifact has five plan sections`,
  );
  check(complete?.artifact?.plan?.estTotal === 3960, `${tag}: artifact total is A$3,960`);
  check(complete?.artifact?.plan?.budgetTotal === 6000, `${tag}: artifact budget is A$6,000`);
  check(complete?.artifact?.metrics?.withinBudget === true, `${tag}: metrics report within budget`);
  check(complete?.artifact?.metrics?.sectionCount === 5, `${tag}: metrics count five sections`);
  const checks = complete?.artifact?.metrics?.checks ?? [];
  check(
    checks.length === 6 && checks.every((item) => item.passed),
    `${tag}: all six named checks pass (${checks.map((item) => item.id).join(", ")})`,
  );
  check(complete?.artifact?.events?.length === 8, `${tag}: artifact carries eight events`);
  check(
    JSON.stringify(complete?.artifact?.events?.map((event) => event.sequence)) ===
      JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]),
    `${tag}: event sequence is monotonic`,
  );
  check(
    !/(api[_-]?key|secret|chain[- ]of[- ]thought|raw prompt)/i.test(body),
    `${tag}: stream contains no sensitive internals`,
  );

  writeFileSync(`${OUT}/${tag}.artifact.json`, JSON.stringify(complete?.artifact, null, 2));
  check(
    (await page.locator("[data-agent-lab-event]").count()) === 8,
    `${tag}: inspector renders eight events`,
  );
  check(
    (await page.locator("[data-agent-lab-section]").count()) === 5,
    `${tag}: UI renders five plan sections`,
  );
  check(
    (await page.getByText("A$3,960", { exact: true }).count()) >= 1,
    `${tag}: UI renders the plan total`,
  );
  check(
    (await page.getByText("Within budget", { exact: true }).count()) >= 1,
    `${tag}: UI renders budget status`,
  );
  check(
    (await page.locator("[data-agent-lab-check]").count()) === checks.length &&
      (await page.locator('[data-agent-lab-check][data-passed="true"]').count()) === checks.length,
    `${tag}: UI lists every named check as passed`,
  );
  check(
    (await page.getByText("6/6 passed", { exact: true }).count()) >= 1,
    `${tag}: UI pass count matches the listed checks`,
  );

  const storageAfter = await workspaceStorage();
  check(storageAfter === storageBefore, `${tag}: Agent Lab does not mutate workspace storage`);
  check(
    await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth),
    `${tag}: no horizontal page overflow`,
  );
  check(
    !errors.length,
    `${tag}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
  );
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });

  if (tag === "desktop") {
    const valid = {
      scenarioId: "tokyo-couple",
      strategyId: "single-agent-baseline",
      dataMode: "fixture",
    };
    const invalidRequests = {
      "unknown scenario": { ...valid, scenarioId: "unknown" },
      "unknown strategy": { ...valid, strategyId: "multi-agent" },
      "unknown data mode": { ...valid, dataMode: "demo" },
      "extra field": { ...valid, prompt: "Do anything" },
    };
    for (const [name, body] of Object.entries(invalidRequests)) {
      const invalid = await page.evaluate(async (payload) => {
        const response = await fetch("/api/agent-lab/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        return { status: response.status, body: await response.json() };
      }, body);
      check(
        invalid.status === 400 && invalid.body?.error === "Invalid Agent Lab request",
        `desktop: ${name} is rejected with an explicit 400`,
      );
    }
  }

  await context.close();
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  await run(browser, { width: 1440, height: 1000, tag: "desktop" });
  await run(browser, { width: 390, height: 844, tag: "phone" });
} finally {
  await browser.close();
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
