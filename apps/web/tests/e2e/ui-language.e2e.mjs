import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/ui-language");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name) => {
  results.push({ ok, name });
  console.log(`${ok ? "ok" : "FAIL"} ${name}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const htmlLang = (page) => page.locator("html").getAttribute("lang");
try {
  const zhContext = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1440, height: 1000 },
  });
  const zhPage = await zhContext.newPage();
  await zhPage.goto(baseUrl);
  await zhPage.getByRole("button", { name: "切换至 English" }).waitFor();
  check((await htmlLang(zhPage)) === "zh-CN", "zh-CN browser opens in Chinese");
  await zhPage.screenshot({ path: `${out}/desktop-zh-browser-default.png`, fullPage: true });
  await zhPage.getByRole("button", { name: "切换至 English" }).click();
  await zhPage.reload();
  await zhPage.getByRole("button", { name: "Switch language to 简体中文" }).waitFor();
  check((await htmlLang(zhPage)) === "en-AU", "saved English overrides a zh-CN browser");
  await zhContext.close();

  const context = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(baseUrl);
  await page.locator(".workspace-app").waitFor();
  await page.locator(".data-mode").waitFor();
  const toggle = page.getByRole("button", { name: "Switch language to 简体中文" });
  await toggle.waitFor({ timeout: 5000 }).catch(() => {});
  check((await toggle.count()) === 1, "language switch is present");
  check((await htmlLang(page)) === "en-AU", "en-AU browser opens in English");
  if ((await toggle.count()) !== 1) throw new Error("Missing language switch");
  check(
    (await page.locator(".data-mode + .language-toggle").count()) === 1,
    "switch sits beside data mode",
  );
  check(
    await page.evaluate(
      () =>
        document.querySelector(".workspace-main").getBoundingClientRect().left -
          document.querySelector(".workspace-sidebar").getBoundingClientRect().right >=
        8,
    ),
    "desktop gutter separates sidebar and main",
  );
  await toggle.click();
  check(
    (await page.locator("html").getAttribute("lang")) === "zh-CN",
    "document switches to Chinese",
  );
  check(await page.getByRole("button", { name: /^聊天/ }).isVisible(), "navigation translates");
  await page.reload();
  await page.getByRole("button", { name: "切换至 English" }).waitFor();
  check((await page.locator("html").getAttribute("lang")) === "zh-CN", "language survives reload");
  await page.getByRole("button", { name: /^账户设置：/ }).click();
  const settings = page.getByRole("dialog");
  await settings.getByRole("tab", { name: "语言与地区" }).click();
  check(
    (await settings.getByRole("button", { name: "更改 显示币种" }).count()) === 1,
    "currency selector remains available",
  );
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${out}/desktop-zh.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "phone has no horizontal overflow",
  );
  await page.getByRole("tab", { name: "我的", exact: true }).click();
  await page.getByRole("button", { name: "切换至 English" }).click();
  check((await htmlLang(page)) === "en-AU", "switch returns to English on phone");
  await page.screenshot({ path: `${out}/phone-en.png`, fullPage: true });
  await page.locator(".phone-topbar__title-button").click();
  await page.locator('.facts-sheet__row[data-fact="where"]').click();
  check(
    await page.getByLabel("Add a destination").isVisible(),
    "legacy address entry remains unchanged",
  );
  check(
    (await page.getByRole("button", { name: "Get current location", exact: true }).count()) === 0,
    "reverse address feature is deferred",
  );
  check(errors.length === 0, `no page errors: ${errors.join(" | ")}`);
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some((item) => !item.ok)) process.exit(1);
