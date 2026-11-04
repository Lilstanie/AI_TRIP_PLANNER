import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/first-paint", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const settings = (overrides) => ({
  version: 1,
  travel: { homeCity: "", preferences: [] },
  dataMode: "mock",
  updatedAt: "2026-11-01T00:00:00Z",
  ...overrides,
});

async function frames(browser, { locale, scheme, saved }) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale,
    colorScheme: scheme,
  });
  await context.addInitScript((saved) => {
    if (saved) localStorage.setItem("trip.settings.v1", JSON.stringify(saved));
    window.__frames = [];
    const tick = () => {
      const nav = document.querySelector(".sidebar-nav");
      if (nav) {
        const frame = {
          nav: nav.textContent.trim().slice(0, 12),
          background: getComputedStyle(document.body).backgroundColor,
        };
        const last = window.__frames.at(-1);
        if (!last || last.nav !== frame.nav || last.background !== frame.background)
          window.__frames.push(frame);
      }
      if (performance.now() < 15_000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, saved);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator(".sidebar-nav").waitFor();
  await page.waitForTimeout(1500);
  const seen = await page.evaluate(() => window.__frames);
  await page.screenshot({ path: `${OUT}/${locale}-${scheme}-${saved?.appearance ?? "none"}.png` });
  await context.close();
  return seen;
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  const zhBrowser = await frames(browser, { locale: "zh-CN", scheme: "light" });
  check(
    zhBrowser.length > 0 && zhBrowser.every((frame) => frame.nav.startsWith("新聊天")),
    "a Chinese browser with no saved language never paints the sidebar in English",
    zhBrowser.map((frame) => frame.nav),
  );

  const zhSaved = await frames(browser, {
    locale: "en-AU",
    scheme: "light",
    saved: settings({ language: "zh", appearance: "system" }),
  });
  check(
    zhSaved.length > 0 && zhSaved.every((frame) => frame.nav.startsWith("新聊天")),
    "a saved Chinese language paints Chinese from the first frame",
    zhSaved.map((frame) => frame.nav),
  );

  const dark = await frames(browser, {
    locale: "en-AU",
    scheme: "light",
    saved: settings({ language: "en", appearance: "dark" }),
  });
  check(
    dark.length > 0 && dark.every((frame) => frame.background === "rgb(0, 0, 0)"),
    "a saved dark appearance on a light system never paints the light page",
    dark.map((frame) => frame.background),
  );

  const light = await frames(browser, {
    locale: "en-AU",
    scheme: "dark",
    saved: settings({ language: "en", appearance: "light" }),
  });
  check(
    light.length > 0 && light.every((frame) => frame.background === "rgb(245, 245, 247)"),
    "a saved light appearance on a dark system never paints the dark page",
    light.map((frame) => frame.background),
  );
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/result.json`, `${JSON.stringify(results, null, 2)}\n`);
const failed = results.filter((result) => !result.ok);
console.log(
  `${results.length - failed.length}/${results.length} checks passed; evidence in ${OUT}`,
);
process.exitCode = failed.length ? 1 : 0;
