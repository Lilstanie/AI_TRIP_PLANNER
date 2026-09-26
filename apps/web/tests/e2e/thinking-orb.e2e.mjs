// End-to-end check of the Think row's orb (thinking-orbs) with mock data: it appears only while a
// request runs, gives way to the static icon when the reply lands, keeps the row's height, and still
// renders a still frame under reduced motion. Screenshots at desktop and phone widths, light and
// dark, land under output/playwright/thinking-orb/ as a repeatable artifact.
//
//   pnpm --filter @trip/web dev            # in another terminal
//   [CHANNEL=chrome] [PLAYWRIGHT=<path to playwright>] node apps/web/tests/e2e/thinking-orb.e2e.mjs
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/thinking-orb");
mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

async function run(browser, { width, height, scheme, reducedMotion = "no-preference" }) {
  const tag = `${width}-${scheme}${reducedMotion === "reduce" ? "-reduced" : ""}`;
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: scheme,
    reducedMotion,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.waitForLoadState("networkidle");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const live = page.getByRole("button", { name: /^Live data/ });
    if (!(await live.count())) break;
    await live.click();
    await page.waitForTimeout(400);
  }
  await page.locator(".chat-empty__suggestions button").first().click();

  const orb = page.locator(".thinking-row__leading canvas.thinking-orb");
  await orb.first().waitFor({ timeout: 30_000 }).catch(() => undefined);
  check((await orb.count()) === 1, `${tag}: orb shows while planning`);
  if (await orb.count()) {
    const box = await orb.first().boundingBox();
    check(!!box && Math.round(box.width) === 20, `${tag}: orb is 20px (${box?.width})`);
    const row = await page.locator(".thinking-turn .thinking-row__line").first().boundingBox();
    // Each running specialist gets its own orb once the turn is expanded.
    await page.locator(".thinking-turn .thinking-row__line").first().click();
    const subOrbs = page.locator(".thinking-subagent .thinking-row__leading canvas.thinking-orb");
    await subOrbs.first().waitFor({ timeout: 30_000 }).catch(() => undefined);
    check((await subOrbs.count()) >= 1, `${tag}: running subagents show orbs (${await subOrbs.count()})`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${tag}-running.png` });
    // Drawn pixels, not an empty canvas: the orb paints on the client.
    const painted = await orb.first().evaluate((canvas) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
      return false;
    });
    check(painted, `${tag}: orb paints`);
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
    await page.waitForTimeout(800);
    check((await orb.count()) === 0, `${tag}: orb gives way to the static icon when done`);
    check((await subOrbs.count()) === 0, `${tag}: finished subagents drop their orbs`);
    const after = await page.locator(".thinking-turn .thinking-row__line").first().boundingBox();
    check(
      !!row && !!after && Math.abs(row.height - after.height) < 1,
      `${tag}: Think row keeps its height (${row?.height} → ${after?.height})`,
    );
    await page.screenshot({ path: `${OUT}/${tag}-done.png` });
  }
  check(!errors.length, `${tag}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await context.close();
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  await run(browser, { width: 1440, height: 1000, scheme: "light" });
  await run(browser, { width: 1440, height: 1000, scheme: "dark" });
  await run(browser, { width: 390, height: 844, scheme: "light" });
  await run(browser, { width: 1440, height: 1000, scheme: "light", reducedMotion: "reduce" });
} finally {
  await browser.close();
}
console.log(`\nScreenshots: ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} check(s) failed`);
  process.exit(1);
}
