import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/trip-day-count");
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
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

  const live = page.getByRole("button", { name: /^Live data/ });
  if (await live.count()) {
    await live.click();
    await page.getByRole("button", { name: /^Mock data/ }).waitFor();
  }

  const chip = page.locator(".chat-empty__suggestions button").first();
  await chip.waitFor();
  const chipLabel = (await chip.innerText()).trim();
  check(
    /Sydney · 4 days/.test(chipLabel),
    `the example chip is labelled as a 4-day trip (${chipLabel})`,
  );
  await chip.click();
  const replied = await page
    .locator(".msg-item--agent .msg-item__body")
    .first()
    .waitFor({ timeout: 240_000 })
    .then(() => true)
    .catch(() => false);
  check(replied, "the planner replies to the example chip");
  if (!replied) await page.screenshot({ path: `${OUT}/no-reply.png` });

  const tripTab = page.locator(".phone-tabbar").getByRole("tab", { name: /^Trip/ });
  await tripTab.waitFor();
  await tripTab.click();

  const drawer = page.locator("#phone-panel-trip");
  const dayTabs = drawer.getByRole("tab", { name: /^Day \d+\b/ });
  await dayTabs
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);
  const dayNames = (await dayTabs.allInnerTexts()).map((text) => text.trim());
  check(
    dayNames.length === 4,
    `the Trip tab shows 4 day tabs (found ${dayNames.length}: ${dayNames.join(" | ")})`,
  );
  check(
    dayNames.every((name, index) => name.startsWith(`Day ${index + 1}`)),
    "the day tabs run Day 1 to Day 4 with none missing",
  );
  check(
    (await drawer.getByRole("tab", { name: /^Day 4\b/ }).count()) === 1,
    "Day 4 is present and can be selected",
  );
  check(
    (await page
      .locator(".fact-chips")
      .getByText(/\b4 days\b/)
      .count()) >= 1,
    "the Dates chip in the trip details shows 4 days",
  );
  check(errors.length === 0, "no page errors");

  await page.screenshot({ path: `${OUT}/phone-day-count.png` });
  writeFileSync(
    `${OUT}/results.json`,
    JSON.stringify({ chip: chipLabel, dayTabs: dayNames, results }, null, 2),
  );
} finally {
  await browser.close();
}

if (results.some((result) => !result.ok)) process.exitCode = 1;
