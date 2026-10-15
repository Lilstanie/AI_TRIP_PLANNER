import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/trip-day-count");
mkdirSync(OUT, { recursive: true });

const settle = (page, ms = 500) => page.waitForTimeout(ms);

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
  await page.waitForLoadState("networkidle");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const live = page.getByRole("button", { name: /^Live data/ });
    if (!(await live.count())) break;
    await live.click();
    await settle(page, 400);
  }

  const chip = page.locator(".chat-empty__suggestions button").first();
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
  await settle(page, 1500);

  const tripTab = page.getByRole("tab", { name: /^Trip/ });
  if (await tripTab.count()) await tripTab.click();
  else await page.getByRole("button", { name: "Open your trip" }).click();
  await settle(page, 700);

  const drawer = page.locator(".workspace-drawer--trip, #phone-panel-trip");
  const dayTabs = drawer.getByRole("tab", { name: /^Day \d+\b/ });
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
  check((await page.getByText(/\b4 days\b/).count()) >= 1, "the top-bar Dates chip shows 4 days");
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
