import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/settings-memory-hidden");
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
  for (const language of ["en", "zh"]) {
    for (const viewport of [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "phone", width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport, locale: "en-AU" });
      await context.addInitScript((savedLanguage) => {
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({
            version: 1,
            travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
            memberships: [],
            assistant: { style: "neutral", memory: false },
            dataMode: "default",
            appearance: "system",
            language: savedLanguage,
            displayCurrency: "AUD",
            updatedAt: new Date(0).toISOString(),
          }),
        );
      }, language);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.locator(".workspace-app").waitFor();
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      if (viewport.width <= 520) {
        await page.getByRole("tab", { name: language === "zh" ? "我的" : "Mine" }).click();
        await page.locator(".phone-mine__settings").click();
      } else {
        await page.locator(".account-button__profile:visible").first().click();
      }
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      await dialog
        .getByRole("tab", { name: language === "zh" ? "个性化" : "Personalization" })
        .click();
      const memorySwitch = dialog.getByRole("switch", {
        name: /Use long-term memory|使用长期记忆/,
      });
      check(
        (await dialog
          .getByText(language === "zh" ? "长期记忆" : "Long-term memory", { exact: true })
          .isVisible()) &&
          (await memorySwitch.count()) === 1 &&
          (await memorySwitch.isDisabled()) &&
          (await dialog
            .getByText(
              language === "zh" ? "登录后即可使用长期记忆。" : "Sign in to use long-term memory.",
              { exact: true },
            )
            .isVisible()),
        `${language} ${viewport.name}: signed-out users see a disabled memory switch and sign-in hint`,
      );
      check(
        await dialog
          .getByRole("button", { name: language === "zh" ? "修改常住地" : "Edit Home base" })
          .isVisible(),
        `${language} ${viewport.name}: travel profile rows remain available`,
      );
      const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("trip.settings.v1") ?? "{}"),
      );
      check(
        stored.assistant?.memory === false,
        `${language} ${viewport.name}: saved assistant.memory=false still loads`,
      );
      await page.screenshot({ path: `${OUT}/${language}-${viewport.name}.png`, fullPage: true });
      check(errors.length === 0, `${language} ${viewport.name}: no page errors`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/summary.json`, JSON.stringify({ results }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
