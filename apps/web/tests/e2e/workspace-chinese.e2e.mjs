// Failure inventory: English controls in Chinese sidebar, chat, trip, timeline or settings;
// untranslated accessible names or storage-full notice; raw traveller/model text altered; overflow at phone width.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/workspace-chinese");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name) => {
  results.push({ ok, name });
  console.log(`${ok ? "ok" : "FAIL"} ${name}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      locale: "zh-CN",
      viewport: { width, height: width === 390 ? 844 : 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
    await page.getByRole("button", { name: "切换至 English" }).waitFor();
    check(
      await page.getByRole("textbox", { name: "向 AI 旅行规划助手发送消息" }).isVisible(),
      `${width}: chat accessible name Chinese`,
    );
    await page.locator(".chat-empty__suggestions button").first().click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180000 });
    await page.getByRole("button", { name: "打开你的行程" }).click();
    await page.locator(".trip-panel").waitFor();
    check(
      await page.getByText("预计总额", { exact: true }).isVisible(),
      `${width}: trip summary Chinese`,
    );
    const english =
      /Estimated total|Within budget|Over budget|Timeline & routes|Review plan|View details|Price unknown|Estimated data|Mock data|Edit itinerary/;
    check(
      !english.test(await page.locator(".trip-panel").innerText()),
      `${width}: no English authored trip labels`,
    );
    const timeline = page.getByRole("tab", { name: "时间线与路线", exact: true });
    await timeline.click();
    check(
      (await page.getByRole("button", { name: /检查.*路线/ }).count()) > 0,
      `${width}: timeline controls Chinese`,
    );
    check(
      !/Check routes|Edit stop|Apply edit|Undo edit|Price unknown|Show on map/.test(
        await page.locator(".trip-panel").innerText(),
      ),
      `${width}: no English authored timeline labels`,
    );
    await page
      .locator(".trip-tabpanel")
      .evaluate((el) =>
        Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {}))),
      );
    await page.screenshot({ path: `${out}/${width}-timeline.png`, fullPage: true });
    await page.keyboard.press("Escape");
    if (width === 390) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    await page.locator('button[aria-label^="账户设置："]:visible').first().click();
    const dialog = page.getByRole("dialog");
    for (const tab of ["编辑个人资料", "你的账户", "个性化", "语言与地区", "已连接账户"]) {
      await dialog.getByRole("tab", { name: tab, exact: true }).click();
      check(
        !/Save preferences|First name|Last name|Location|Theme|Communication style|Standing preferences|Home base|Accounts are not set up|Sign in|Long-term memory|Default trip data|Connected accounts/.test(
          await dialog.innerText(),
        ),
        `${width}: ${tab} has no English authored labels`,
      );
    }
    await dialog.getByRole("tab", { name: "个性化" }).click();
    await page.getByText("交流风格", { exact: true }).waitFor();
    await page
      .locator(".settings-panel")
      .evaluate((el) =>
        Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {}))),
      );
    await page.screenshot({ path: `${out}/${width}-settings.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await page.route("**/api/chat", (route) =>
      route.fulfill({ status: 503, contentType: "text/plain", body: "unavailable" }),
    );
    await page.getByRole("textbox", { name: "向 AI 旅行规划助手发送消息" }).fill("test failure");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    const fallbackError = page.getByRole("alert").filter({ hasText: "请求失败（503）。" }).first();
    await fallbackError.waitFor();
    check(await fallbackError.isVisible(), `${width}: authored HTTP fallback error Chinese`);
    await page.unroute("**/api/chat");
    check(errors.length === 0, `${width}: no page errors ${errors.join(" | ")}`);
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width}: no overflow`,
    );
    await context.close();
  }
  // Storage that refuses every write must still explain itself in Chinese.
  const full = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1440, height: 1000 },
  });
  await full.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  const fullPage = await full.newPage();
  await fullPage.goto(process.env.BASE_URL ?? "http://localhost:3000");
  const storageError = fullPage.getByText("浏览器存储不可用或已满", { exact: false }).first();
  await storageError.waitFor();
  check(await storageError.isVisible(), "storage-full notice Chinese");
  await fullPage.screenshot({ path: `${out}/1440-storage-full.png` });
  await full.close();
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some((x) => !x.ok)) process.exit(1);
