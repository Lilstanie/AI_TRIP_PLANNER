import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/no-arrival-without-origin");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const CASES = [
  {
    name: "no-origin",
    message:
      "Plan a 4-day trip to Sydney for 2 people from 2026-11-06 to 2026-11-09, total budget 4000.",
    arrival: false,
  },
  {
    name: "origin-is-destination",
    message:
      "Plan a 4-day trip from Sydney to Sydney for 2 people from 2026-11-06 to 2026-11-09, total budget 4000.",
    arrival: false,
  },
  {
    name: "origin-melbourne",
    message:
      "Plan a 4-day trip from Melbourne to Sydney for 2 people from 2026-11-06 to 2026-11-09, total budget 4000.",
    arrival: true,
  },
];

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const seen = {};
try {
  for (const item of CASES) {
    const context = await browser.newContext({
      locale: "en-AU",
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
    await page.getByLabel("Message AI Trip Planner").fill(item.message);
    await page.getByRole("button", { name: "Send" }).click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });

    await tab("Trip").click();
    await page.waitForTimeout(1000);
    const trip = await page.locator("main, body").first().innerText();
    seen[item.name] = trip.slice(0, 4000);
    check(trip.includes("Sydney"), `${item.name}: the Trip tab shows the Sydney plan`);
    check(
      !/Sydney airport/i.test(trip),
      `${item.name}: no invented "Sydney airport → Sydney" transfer`,
    );
    if (item.arrival)
      check(/Melbourne/.test(trip), `${item.name}: the arrival journey from Melbourne is planned`);
    await page.screenshot({ path: `${OUT}/${item.name}.png` });
    check(errors.length === 0, `${item.name}: no page errors`);
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify({ results, seen }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
