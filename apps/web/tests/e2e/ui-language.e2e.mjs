// Failure inventory: switch absent, fails to translate, language lost on reload,
// sidebar overlaps main, narrow layout scrolls horizontally, or unrelated currency/address UI leaks in.
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
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
  await page.locator(".workspace-app").waitFor();
  await page.locator(".data-mode").waitFor();
  const toggle = page.getByRole("button", { name: "Switch language to 简体中文" });
  check((await toggle.count()) === 1, "language switch is present");
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
    (await settings.getByRole("button", { name: "更改 显示币种" }).count()) === 0,
    "currency selector is deferred",
  );
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${out}/desktop-zh.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "phone has no horizontal overflow",
  );
  await page.getByRole("button", { name: "切换至 English" }).click();
  check(
    (await page.locator("html").getAttribute("lang")) === "en",
    "switch returns to English on phone",
  );
  await page.screenshot({ path: `${out}/phone-en.png`, fullPage: true });
  await page.getByRole("button", { name: "Where", exact: true }).click();
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
