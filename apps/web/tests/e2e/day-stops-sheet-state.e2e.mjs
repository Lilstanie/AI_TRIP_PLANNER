import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/day-stops-sheet-state", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const copy = {
  en: { label: "Day stops", tab: /^Map/ },
  zh: { label: "当日站点", tab: /^地图/ },
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const language of ["en", "zh"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
      locale: language === "zh" ? "zh-CN" : "en-AU",
    });
    await context.addInitScript((language) => {
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "", preferences: [] },
          language,
          dataMode: "mock",
          appearance: "system",
          updatedAt: "2026-10-23T00:00:00Z",
        }),
      );
    }, language);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy[language].tab }).click();
    const sheet = page.locator(".phone-map-sheet");
    const handle = sheet.locator(".phone-map-sheet__handle");
    await handle.waitFor();
    const read = async () => ({
      snap: await sheet.getAttribute("data-snap"),
      name: await handle.evaluate(
        (node) => node.getAttribute("aria-label") ?? node.textContent.trim(),
      ),
      expanded: await handle.getAttribute("aria-expanded"),
    });
    const seen = {};
    const steps = [
      ["start", null],
      ["ArrowUp", "ArrowUp"],
      ["ArrowDown", "ArrowDown"],
      ["Home", "Home"],
      ["click", "click"],
      ["End", "End"],
      ["Escape", "Escape"],
    ];
    for (const [step, action] of steps) {
      if (action === "click") await handle.click();
      else if (action) await handle.press(action);
      const state = await read();
      const previous = seen[state.snap];
      check(
        previous === undefined || previous === state.name,
        `${language} ${step}: the ${state.snap} step always has the same name`,
        state,
      );
      seen[state.snap] = state.name;
      check(
        state.expanded === String(state.snap !== "handle"),
        `${language} ${step}: aria-expanded matches the ${state.snap} step`,
        state,
      );
      check(
        state.name.toLowerCase().includes(copy[language].label.toLowerCase()),
        `${language} ${step}: the name keeps the visible label`,
        state.name,
      );
      if (language === "zh")
        check(
          !/[A-Za-z]/.test(state.name),
          `${language} ${step}: the Chinese name has no English`,
          state.name,
        );
    }
    const names = Object.values(seen);
    check(
      Object.keys(seen).length === 3 && new Set(names).size === 3,
      `${language}: collapsed, half and full each announce a different name`,
      seen,
    );
    await page.screenshot({ path: `${OUT}/390-${language}.png` });
    writeFileSync(`${OUT}/names-${language}.json`, JSON.stringify(seen, null, 2));
    check(errors.length === 0, `${language}: browser has no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
