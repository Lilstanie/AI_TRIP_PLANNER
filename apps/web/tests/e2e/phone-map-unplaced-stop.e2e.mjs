import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip } from "./trip-setup.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/phone-map-unplaced-stop");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name, detail) => {
  results.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const zh of [false, true]) {
    const label = zh ? "zh-CN" : "en-AU";
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));
    await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
    await planSuggestedTrip(page);
    const tab = (en, cn) =>
      page.locator(".phone-tabbar").getByRole("tab", { name: new RegExp(`^${zh ? cn : en}`) });
    if (zh) {
      await page.locator(".phone-tabbar").getByRole("tab", { name: /^Mine/ }).click();
      await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
      await page.waitForFunction(() => document.documentElement.lang === "zh-CN");
    }
    await tab("Map", "地图").click();
    const rows = page.locator(".phone-map-sheet__stops button");
    await rows.first().waitFor();
    const read = await rows.evaluateAll((buttons) =>
      buttons.map((button) => ({
        name: button.textContent.trim(),
        title: button.querySelector(".phone-map-sheet__title")?.textContent.trim() ?? "",
        circle: button.querySelector(".phone-map-sheet__number")?.textContent.trim() ?? null,
        status: button.querySelector("small")?.textContent.trim() ?? "",
      })),
    );
    check(read.length > 0, `${label} the Day stops sheet lists stops`, read.length);
    check(
      read.every(({ title }) => /^Mock attraction near /.test(title)),
      `${label} each row leads with the place name`,
      read.map(({ title }) => title),
    );
    check(
      read.every(({ name }) => name.length < 80),
      `${label} each row's accessible name is short, not the description`,
      read.map(({ name }) => name.length),
    );
    check(
      read.every(({ circle }) => circle === null || circle !== ""),
      `${label} no row shows an empty number circle`,
      read.map(({ circle }) => circle),
    );
    check(
      read.every(({ status }) => status.includes(zh ? "地图上未找到" : "Not found on the map")),
      `${label} each row says the stop is not on the map`,
      read.map(({ status }) => status),
    );
    await page.screenshot({ path: `${out}/${label}.png` });
    check(errors.length === 0, `${label} no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some((x) => !x.ok)) process.exit(1);
