import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/progressive-empty-workspace", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const dismissLocation = async (page, language) => {
  const notNow = page.getByRole("button", { name: language === "zh" ? "暂不" : "Not now" });
  await notNow.waitFor({ timeout: 5000 }).then(
    () => notNow.click(),
    () => {},
  );
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    locale: "en-AU",
  });
  await desktop.addInitScript(() => {
    localStorage.setItem(
      "trip.settings.v1",
      JSON.stringify({
        version: 1,
        travel: { homeCity: "", travellers: 2, budget: 4000, preferences: [] },
        language: "en",
        dataMode: "mock",
        appearance: "system",
        updatedAt: "2026-10-25T00:00:00Z",
      }),
    );
  });
  const page = await desktop.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await dismissLocation(page, "en");
  await page.locator(".chat-empty__suggestions").waitFor();

  check(
    (await page.locator(".chat-empty h3").count()) === 0,
    "desktop blank: no Where to next card",
  );
  check(
    (await page.locator(".fact-chips").count()) === 0,
    "desktop blank: Brief bar hidden despite Travel profile prefills",
  );
  check(
    (await page.getByRole("button", { name: "Open your trip" }).count()) === 0,
    "desktop blank: Trip hidden without a Plan",
  );
  check(
    (await page.getByRole("button", { name: /Switch language/i }).count()) === 0,
    "desktop blank: no language shortcut",
  );
  check(
    (await page.getByRole("tab", { name: "Conversation" }).count()) === 1 &&
      (await page.getByRole("button", { name: "Agent Team" }).count()) === 1,
    "desktop blank: Conversation tab and Agent Team top-left",
  );
  check(
    (await page.locator(".data-mode:visible").count()) === 1,
    "desktop blank: Live/Mock remains",
  );
  await page.screenshot({ path: `${OUT}/desktop-blank.png` });

  const composer = page.locator(".composer textarea, .composer__input, textarea").first();
  await composer.click();
  await composer.fill("Tokyo");
  await page.waitForTimeout(200);
  check((await page.locator(".fact-chips").count()) === 1, "typing reveals Brief bar");
  check(
    (await page.locator(".chat-empty__suggestions").count()) === 0,
    "typing hides suggestion chips",
  );
  await page.screenshot({ path: `${OUT}/desktop-typing.png` });

  await composer.fill("");
  await page.waitForTimeout(200);
  check(
    (await page.locator(".fact-chips").count()) === 0 &&
      (await page.locator(".chat-empty__suggestions").count()) === 1,
    "clearing input restores blank untouched chrome",
  );

  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "Here is a starter plan.",
        plan: {
          tripId: "e2e-progressive",
          brief: {
            tripId: "e2e-progressive",
            userId: "local",
            destination: "Sydney",
            dates: ["2026-11-10", "2026-11-14"],
            party: { adults: 2 },
            budget: { total: 4000, currency: "AUD" },
          },
          itinerary: { days: [], ideas: [] },
          transport: { legs: [] },
          accommodation: { stays: [] },
          dining: { meals: [] },
          destinationGuide: { highlights: [] },
          totals: { estimated: 0, currency: "AUD" },
        },
      }),
    });
  });
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.getByRole("button", { name: "Open your trip" }).waitFor({ timeout: 15000 });
  check(
    (await page.getByRole("button", { name: "Open your trip" }).count()) === 1,
    "Trip appears once a Plan exists",
  );
  await page.screenshot({ path: `${OUT}/desktop-plan.png` });
  check(errors.length === 0, "desktop: no page errors", errors);
  await desktop.close();

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    locale: "en-AU",
  });
  await phone.addInitScript(() => {
    localStorage.setItem(
      "trip.settings.v1",
      JSON.stringify({
        version: 1,
        travel: { homeCity: "", preferences: [] },
        language: "en",
        dataMode: "mock",
        appearance: "system",
        updatedAt: "2026-10-25T00:00:00Z",
      }),
    );
  });
  const phonePage = await phone.newPage();
  const phoneErrors = [];
  phonePage.on("pageerror", (error) => phoneErrors.push(String(error)));
  await phonePage.goto(BASE, { waitUntil: "domcontentloaded" });
  await dismissLocation(phonePage, "en");
  await phonePage.getByRole("tab", { name: /^Chat/ }).click();
  check(
    (await phonePage.getByRole("tab", { name: /^Trip/ }).count()) === 0,
    "phone blank: Trip tab hidden without a Plan",
  );
  await phonePage.getByRole("tab", { name: "Mine", exact: true }).click();
  check(
    (await phonePage.getByRole("button", { name: /Switch language/i }).count()) === 0,
    "phone Mine: no language shortcut",
  );
  check(
    (await phonePage.locator(".data-mode:visible").count()) === 1,
    "phone Mine: data mode remains",
  );
  await phonePage.screenshot({ path: `${OUT}/phone-mine.png` });
  check(phoneErrors.length === 0, "phone: no page errors", phoneErrors);
  await phone.close();
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/result.json`, JSON.stringify({ results }, null, 2));
}
if (results.some(({ ok }) => !ok)) process.exit(1);
