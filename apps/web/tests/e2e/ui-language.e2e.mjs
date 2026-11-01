import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/ui-language", process.env.LABEL ?? "run");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name) => {
  results.push({ ok, name });
  console.log(`${ok ? "ok" : "FAIL"} ${name}`);
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const htmlLang = (page) => page.locator("html").getAttribute("lang");
const dismissLocation = async (page) => {
  const button = page.getByRole("button", { name: /^(Not now|暂不)$/ });
  await button.waitFor({ timeout: 5000 }).then(
    () => button.click(),
    () => {},
  );
};
const errors = [];
let activePage;
const region = async (page) => {
  const zh = (await htmlLang(page)) === "zh-CN";
  if (page.viewportSize().width <= 520) {
    await page.getByRole("tab", { name: zh ? "我的" : "Mine", exact: true }).click();
    await page
      .getByRole("button", { name: zh ? "设置与账户" : "Settings & account", exact: true })
      .click();
  } else {
    await page.getByRole("button", { name: /^(Account settings:|账户设置：)/ }).click();
  }
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: zh ? "语言与地区" : "Language & region" }).click();
  return dialog;
};
const switchLanguage = async (page, language) => {
  const dialog = await region(page);
  await dialog.getByRole("button", { name: /^(Change Language|更改 语言)$/ }).click();
  await dialog
    .getByRole("button", { name: language === "en" ? "English" : "简体中文", exact: true })
    .click();
  await page.keyboard.press("Escape");
};
try {
  const zhContext = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1440, height: 1000 },
  });
  const zhPage = await zhContext.newPage();
  await zhPage.goto(baseUrl);
  await dismissLocation(zhPage);
  check((await htmlLang(zhPage)) === "zh-CN", "zh-CN browser opens in Chinese");
  await zhPage.screenshot({ path: `${out}/desktop-zh-browser-default.png`, fullPage: true });
  await switchLanguage(zhPage, "en");
  await zhPage.reload();
  await zhPage.getByRole("tab", { name: "Conversation", exact: true }).waitFor();
  check((await htmlLang(zhPage)) === "en-AU", "saved English overrides a zh-CN browser");
  await zhContext.close();
  const context = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  activePage = page;
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(baseUrl);
  await dismissLocation(page);
  await page.locator(".data-mode").waitFor();
  check((await htmlLang(page)) === "en-AU", "en-AU browser opens in English");
  check((await page.locator(".language-toggle").count()) === 0, "language shortcut is absent");
  check(
    await page.evaluate(
      () =>
        document.querySelector(".workspace-main").getBoundingClientRect().left -
          document.querySelector(".workspace-sidebar").getBoundingClientRect().right >=
        8,
    ),
    "desktop gutter separates sidebar and main",
  );
  await switchLanguage(page, "zh");
  check((await htmlLang(page)) === "zh-CN", "Settings switches document to Chinese");
  await page.reload();
  await page.getByRole("tab", { name: "对话", exact: true }).waitFor();
  check((await htmlLang(page)) === "zh-CN", "language survives reload");
  const settings = await region(page);
  check(
    (await settings.getByRole("button", { name: "更改 显示币种" }).count()) === 1,
    "currency selector remains available",
  );
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${out}/desktop-zh.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.getByRole("tab", { name: "我的", exact: true }).waitFor();
  check(
    await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
    "phone has no horizontal overflow",
  );
  await page.screenshot({ path: `${out}/phone-zh.png`, fullPage: true });
  await switchLanguage(page, "en");
  check((await htmlLang(page)) === "en-AU", "phone Settings switches back to English");
  await page.getByRole("tab", { name: /^Chat/ }).click();
  await page.screenshot({ path: `${out}/phone-en.png`, fullPage: true });
  check(errors.length === 0, `no page errors: ${errors.join(" | ")}`);
  await context.close();
} catch (error) {
  if (activePage) {
    await activePage.screenshot({ path: `${out}/failure.png`, fullPage: true });
    writeFileSync(`${out}/failure.txt`, await activePage.locator("body").innerText());
  }
  check(false, `journey completes: ${String(error)}; page errors: ${errors.join(" | ")}`);
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some((item) => !item.ok)) process.exit(1);
