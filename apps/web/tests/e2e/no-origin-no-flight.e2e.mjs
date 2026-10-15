import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/no-origin-no-flight");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto(BASE);
  await page.locator(".phone-tabbar").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const tab = (name) =>
    page.locator(".phone-tabbar").getByRole("tab", { name: new RegExp(`^${name}`) });

  await tab("Chat").click();
  await page
    .getByLabel("Message AI Trip Planner")
    .fill(
      "Plan a 3-day trip to Tokyo for 1 person from 2026-10-25 to 2026-10-27, total budget 1500.",
    );
  await page.getByRole("button", { name: "Send" }).click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180000 });
  const reply = await page.locator(".msg-item--agent .msg-item__body").last().innerText();
  check(!/Sydney/.test(reply), "the reply does not assume a Sydney departure");

  await tab("Trip").click();
  await page.waitForTimeout(1000);
  const trip = await page.locator("main, body").first().innerText();
  check(trip.includes("Tokyo"), "the Trip tab shows the Tokyo plan");
  check(!/MockAir/.test(trip), "the Trip tab has no flight the traveller never asked for");
  check(!/Sydney\s*→\s*Tokyo/.test(trip), "the Trip tab has no Sydney → Tokyo leg");
  await page.screenshot({ path: `${OUT}/trip.png` });
  check(errors.length === 0, "no page errors");
  await context.close();
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
