import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/first-question",
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

const send = async (page, text) => {
  const before = await page.locator(".msg-item--agent").count();
  const box = page.locator("textarea").first();
  await box.fill(text);
  await box.press("Enter");
  await page.locator(".msg-item--agent").nth(before).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(400);
  return (await page.locator(".msg-item--agent .msg-item__body").nth(before).innerText()).trim();
};

const journeys = [
  {
    locale: "en-AU",
    label: "en",
    vague: "I want a holiday",
    firstAsk: /^Where would you like to go\?/,
    place: "I want to go to Lisbon",
    placeAsk: /^When are you travelling to Lisbon\?/,
    generic: /holiday/i,
  },
  {
    locale: "zh-CN",
    label: "zh",
    vague: "我想去旅游",
    firstAsk: /^你想去哪里？/,
    place: "我想去里斯本",
    placeAsk: /^打算哪天去里斯本，哪天回来？/,
    generic: /旅游/,
  },
];

try {
  for (const journey of journeys) {
    const context = await browser.newContext({
      locale: journey.locale,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto(BASE, { waitUntil: "networkidle" });

    const first = await send(page, journey.vague);
    const facts = (await page.locator(".fact-chips").first().innerText()).trim();
    await page.screenshot({ path: resolve(out, `${journey.label}-first.png`) });
    const second = await send(page, journey.place);
    await page.screenshot({ path: resolve(out, `${journey.label}-second.png`) });
    writeFileSync(
      resolve(out, `${journey.label}-replies.json`),
      JSON.stringify({ first, facts, second }, null, 2),
    );

    check(
      journey.firstAsk.test(first),
      `${journey.label}: a vague request gets one question`,
      first,
    );
    check(
      !journey.generic.test(facts),
      `${journey.label}: the generic word is not saved as the destination`,
      facts,
    );
    check(
      journey.placeAsk.test(second),
      `${journey.label}: the next question names the destination`,
      second,
    );
    check(pageErrors.length === 0, `${journey.label}: no page errors`, pageErrors);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(resolve(out, "summary.json"), JSON.stringify({ base: BASE, checks }, null, 2));
}
const failed = checks.filter((item) => !item.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed; evidence in ${out}`);
if (failed.length) process.exit(1);
