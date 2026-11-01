import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/topbar-fit",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.CHANNEL });

const measure = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector(".workspace-topbar");
    const box = (selector) => {
      const node = selector ? bar.querySelector(selector) : bar;
      if (!node) return undefined;
      const rect = node.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    return {
      title: box(".chat-header__heading"),
      team: box(".team-trigger"),
      chips: box(".fact-chips__scroller"),
      mode: box(".data-mode"),
      trip: box(".trip-trigger"),
      bar: box(),
    };
  });
const overlap = (a, b) =>
  a &&
  b &&
  a.left < b.right - 1 &&
  b.left < a.right - 1 &&
  a.top < b.bottom - 1 &&
  b.top < a.bottom - 1;

const results = {};
try {
  const context = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const box = page.locator("textarea").first();
  await box.fill("Plan 4 days in Lisbon from Sydney, 2 people, budget 6000 AUD, from 2027-03-10");
  await box.press("Enter");
  await page.locator(".msg-item--agent .msg-item__clock").first().waitFor({ timeout: 90_000 });
  const tripButton = page.locator(".trip-trigger");
  if ((await tripButton.getAttribute("aria-expanded")) !== "true") await tripButton.click();
  await page.locator(".trip-workspace .trip-panel").waitFor();

  for (const width of [1100, 1200, 1280, 1366, 1440, 1536, 1680, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(400);
    const bar = await measure(page);
    results[width] = bar;
    await page.screenshot({
      path: resolve(out, `topbar-${width}.png`),
      clip: { x: bar.bar.left, y: 0, width: bar.bar.width, height: bar.bar.bottom + 4 },
    });
    const pairs = [
      ["chips", "team"],
      ["chips", "mode"],
      ["chips", "trip"],
      ["chips", "title"],
      ["title", "team"],
      ["team", "mode"],
    ].filter(([a, b]) => overlap(bar[a], bar[b]));
    check(pairs.length === 0, `${width}px: no top bar controls overlap`, pairs);
    check(
      bar.title && bar.title.width >= 120,
      `${width}px: the chat title stays readable`,
      bar.title,
    );
    check(
      bar.chips && bar.chips.width >= 200 && bar.chips.right <= bar.bar.right,
      `${width}px: the trip facts stay visible inside the bar`,
      bar.chips,
    );
    check(!bar.team || bar.team.height <= 48, `${width}px: Agent Team stays on one line`, bar.team);
  }
  check(pageErrors.length === 0, "no page errors", pageErrors);
  await context.close();
} finally {
  await browser.close();
  writeFileSync(
    resolve(out, "summary.json"),
    JSON.stringify({ base: BASE, checks, results }, null, 2),
  );
}
const failed = checks.filter((item) => !item.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed; evidence in ${out}`);
if (failed.length) process.exit(1);
