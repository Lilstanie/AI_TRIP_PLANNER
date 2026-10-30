import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/reply-day-cards",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const REQUEST = "Lisbon, 2027-11-02 to 2027-11-06, 2 people, budget $3000";
const browser = await chromium.launch({ channel: process.env.CHANNEL });

const plan = async (page, request = REQUEST) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  const box = page.locator("textarea").first();
  await box.fill(request);
  await box.press("Enter");
  await page
    .locator(".msg-item--agent")
    .last()
    .locator(".msg-item__clock")
    .waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
};

const selectedDay = (page) =>
  page.locator('.day-strip__day[aria-selected="true"]').first().innerText({ timeout: 5_000 });

const journeys = [
  { label: "desktop", locale: "en-AU", viewport: { width: 1440, height: 900 }, pick: 2 },
  {
    label: "phone",
    locale: "en-AU",
    viewport: { width: 390, height: 844 },
    phone: true,
    pick: 1,
  },
  { label: "zh", locale: "zh-CN", viewport: { width: 1440, height: 900 }, pick: 3 },
];

try {
  for (const journey of journeys) {
    const context = await browser.newContext({
      locale: journey.locale,
      viewport: journey.viewport,
      ...(journey.phone ? { isMobile: true, hasTouch: true } : {}),
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await plan(page);
    const cards = page.locator(".msg-item--agent .plan-day");
    const labels = await cards.allInnerTexts();
    await page.screenshot({ path: resolve(out, `${journey.label}-reply.png`) });
    check(labels.length === 5, `${journey.label}: one card per trip day`, labels);
    if (journey.locale === "zh-CN")
      check(labels[0]?.startsWith("第 1 天"), "zh: the cards are labelled in Chinese", labels[0]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(overflow <= 0, `${journey.label}: the cards do not widen the page`, overflow);
    if (labels.length) {
      await cards.nth(journey.pick).click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: resolve(out, `${journey.label}-opened.png`) });
      const day = await selectedDay(page).catch(() => "");
      const expected =
        journey.locale === "zh-CN" ? `第 ${journey.pick + 1} 天` : `Day ${journey.pick + 1}`;
      check(day.startsWith(expected), `${journey.label}: a card opens the trip on its day`, day);
    }
    check(pageErrors.length === 0, `${journey.label}: no page errors`, pageErrors);
    await context.close();
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await plan(page, "I want a holiday");
  check(
    (await page.locator(".plan-day").count()) === 0,
    "a reply that only asks a question shows no cards",
  );
  await plan(page);
  const animation = await page
    .locator(".plan-days__item")
    .first()
    .evaluate((node) => getComputedStyle(node).animationName)
    .catch(() => "missing");
  check(animation === "none", "reduced motion turns the card entrance off", animation);
  await context.close();
} finally {
  await browser.close();
  writeFileSync(resolve(out, "summary.json"), JSON.stringify({ base: BASE, checks }, null, 2));
}
const failed = checks.filter((item) => !item.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed; evidence in ${out}`);
if (failed.length) process.exit(1);
