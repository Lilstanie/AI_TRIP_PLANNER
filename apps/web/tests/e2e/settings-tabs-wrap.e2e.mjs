import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/settings-tabs-wrap");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const SWITCH_TO_CHINESE = "Switch language to 简体中文";

const tabsInside = (page) =>
  page.evaluate(() => {
    const dialog = document.querySelector("dialog[open], [role='dialog'][aria-modal='true']");
    const box = dialog.getBoundingClientRect();
    const tabs = [...dialog.querySelectorAll("[role='tab']")].map((tab) => {
      const rect = tab.getBoundingClientRect();
      return {
        name: tab.textContent.trim(),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        inside: rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5 && rect.width > 0,
      };
    });
    return {
      tabs,
      pageScroll: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const measured = [];
try {
  for (const width of [375, 390]) {
    for (const language of ["en", "zh"]) {
      const context = await browser.newContext({
        locale: "en-AU",
        viewport: { width, height: 812 },
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
      const mine = page.locator(".phone-mine");
      await page.locator(".phone-tabbar").getByRole("tab").last().click();
      await mine.waitFor();
      if (language === "zh") {
        await mine.getByRole("button", { name: SWITCH_TO_CHINESE }).click();
        await page.locator("html[lang='zh-CN']").waitFor({ state: "attached" });
      }
      await page.locator(".phone-mine__settings").click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(400);
      const result = await tabsInside(page);
      measured.push({ width, language, ...result });
      const tag = `${width} px ${language}`;
      check(result.tabs.length === 5, `${tag}: the dialog has five tabs (${result.tabs.length})`);
      const outside = result.tabs.filter((tab) => !tab.inside).map((tab) => tab.name);
      check(
        outside.length === 0,
        `${tag}: every tab is inside the dialog${outside.length ? ` (outside: ${outside.join(", ")})` : ""}`,
      );
      check(
        result.pageScroll <= 0,
        `${tag}: the page does not scroll sideways (${result.pageScroll}px)`,
      );
      await page.screenshot({ path: `${OUT}/phone-${width}-${language}.png` });
      check(errors.length === 0, `${tag}: no page errors`);
      await context.close();
    }
  }

  const desktop = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1280, height: 800 },
  });
  const page = await desktop.newPage();
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.locator('button[aria-label="Open account menu"]:visible').first().click();
  await page.getByRole("menuitem", { name: "Personalization" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(400);
  const result = await tabsInside(page);
  measured.push({ width: 1280, language: "en", ...result });
  const lefts = new Set(result.tabs.map((tab) => tab.left));
  check(
    lefts.size === 1,
    `desktop: the tabs stay in one vertical column (${[...lefts].join(", ")})`,
  );
  await page.screenshot({ path: `${OUT}/desktop-1280.png` });
  await desktop.close();
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify({ measured, results }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
