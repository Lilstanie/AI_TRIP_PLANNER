import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setPhoneLanguage } from "./phone-settings.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/activities-not-costed", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const amount = /(?:A\$|AUD\s*)([\d,]+\.\d{2})/;
const COPY = {
  en: {
    trip: /^Trip/,
    names: ["Accommodation", "Transport", "Meals", "Activities"],
    notCosted: "Not costed",
    unpriced: /\d+ unpriced/,
  },
  zh: {
    trip: /^行程/,
    names: ["住宿", "交通", "餐饮", "活动"],
    notCosted: "未计价",
    unpriced: /\d+\s*项未定价/,
  },
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    locale: "en-AU",
  });
  await context.addInitScript(() => {
    if (localStorage.getItem("trip.settings.v1")) return;
    localStorage.setItem(
      "trip.settings.v1",
      JSON.stringify({
        version: 1,
        travel: { homeCity: "", preferences: [] },
        language: "en",
        dataMode: "mock",
        appearance: "system",
        updatedAt: "2026-10-23T00:00:00Z",
      }),
    );
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const notNow = page.getByRole("button", { name: "Not now" });
  await notNow.waitFor({ timeout: 5000 }).then(
    () => notNow.click(),
    () => {},
  );
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });

  for (const language of ["en", "zh"]) {
    const copy = COPY[language];
    if (language === "zh") {
      await page.locator(".phone-tabbar").getByRole("tab", { name: /^Mine/ }).click();
      await setPhoneLanguage(page, "zh");
    }
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy.trip }).click();
    const card = page.locator("#phone-panel-trip .trip-budget");
    await card.waitFor();
    if (!(await card.evaluate((node) => node.open))) await card.locator("summary").click();
    const breakdown = card.locator(".trip-panel__budget-breakdown");
    await breakdown.waitFor();
    const rows = Object.fromEntries(
      (await breakdown.locator("li").allInnerTexts()).map((text) => {
        const [name, ...rest] = text.split("\n");
        return [name.trim(), rest.join(" ").trim()];
      }),
    );
    const [stay, transport, meals, activities] = copy.names.map((name) => rows[name] ?? "");
    check(
      activities.includes(copy.notCosted) && !amount.test(activities),
      `${language}: Activities with no priced stop reads "${copy.notCosted}" with no amount`,
      rows,
    );
    const line = await card.locator("summary").innerText();
    check(copy.unpriced.test(line), `${language}: the budget line shows the unpriced count`, line);
    check(
      transport.includes(copy.notCosted),
      `${language}: Transport still reads "${copy.notCosted}"`,
      transport,
    );
    check(
      amount.test(stay) && amount.test(meals),
      `${language}: Accommodation and Meals keep their estimates`,
      [stay, meals],
    );
    const total = await card.locator(".trip__budget strong").innerText();
    const sum = Object.values(rows)
      .map((text) => Number(text.match(amount)?.[1].replaceAll(",", "") ?? 0))
      .reduce((a, b) => a + b, 0);
    check(
      Number(total.match(amount)?.[1].replaceAll(",", "")) === sum,
      `${language}: the category amounts add up to the estimated total`,
      { total, sum },
    );
    await card.screenshot({ path: `${OUT}/${language}-budget.png` });
  }
  check(errors.length === 0, "browser has no page errors", errors);
  await context.close();
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
