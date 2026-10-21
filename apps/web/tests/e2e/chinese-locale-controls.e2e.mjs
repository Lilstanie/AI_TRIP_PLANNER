import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/chinese-locale-controls");
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok, name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
const sent = [];
try {
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.route("**/api/chat", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Fixture unavailable" }),
    });
  });
  await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.getByRole("tab", { name: "我的", exact: true }).click();
  const mode = page.locator(".data-mode:visible");
  await mode.waitFor();
  const chineseMockTitle = await mode.getAttribute("title");
  check(
    chineseMockTitle === "示例数据：使用内置示例，不会请求服务商，也不会消耗额度。",
    "Chinese mock data tooltip is localized",
    chineseMockTitle,
  );
  await page.getByRole("button", { name: "切换至 English" }).click();
  const englishTitle = await page.locator(".data-mode:visible").getAttribute("title");
  check(
    englishTitle === "Mock data: bundled fixtures. No provider requests and no allowance spent.",
    "English mock data tooltip is unchanged",
    englishTitle,
  );
  await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
  await page.waitForFunction(() => document.documentElement.lang === "zh-CN");
  await page.getByRole("tab", { name: /^聊天/ }).click();
  await page.getByRole("button", { name: "悉尼 · 4 天", exact: true }).click();
  await page.locator(".error-banner").waitFor();
  const prompt = sent.at(-1)?.message;
  const dates = prompt?.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  check(
    typeof prompt === "string" && /计划/.test(prompt) && /悉尼/.test(prompt),
    "Sydney example chip submits Chinese text",
    prompt,
  );
  check(
    dates.length === 2 &&
      dates[1] > dates[0] &&
      /2\s*(人|位)/.test(prompt ?? "") &&
      /4000/.test(prompt ?? ""),
    "Chinese example prompt preserves dates, travellers, and budget",
    { dates, prompt },
  );
  await page.getByRole("tab", { name: /^我的/ }).click();
  const blankChat = page.locator(".history-item").filter({ hasText: "新聊天" }).first();
  await blankChat.waitFor();
  const action = blankChat.locator(".history-item__more");
  const actionName = await action.getAttribute("aria-label");
  check(
    actionName === "新聊天的操作",
    "untitled chat action name matches its Chinese title",
    actionName,
  );
  await page.screenshot({ path: `${out}/phone-zh.png`, fullPage: true });
  check(pageErrors.length === 0, "no browser page errors", pageErrors);
  await context.close();

  const desktopContext = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1440, height: 1000 },
  });
  const desktopPage = await desktopContext.newPage();
  let desktopPrompt;
  await desktopPage.route("**/api/chat", async (route) => {
    desktopPrompt = JSON.parse(route.request().postData() ?? "{}").message;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Fixture unavailable" }),
    });
  });
  await desktopPage.goto(process.env.BASE_URL ?? "http://localhost:3000");
  await desktopPage.locator(".workspace-app").waitFor();
  const desktopMode = desktopPage.locator(".data-mode:visible");
  const desktopTitle = await desktopMode.getAttribute("title");
  check(
    desktopTitle === "示例数据：使用内置示例，不会请求服务商，也不会消耗额度。",
    "desktop Chinese data-mode tooltip is localized",
    desktopTitle,
  );
  await desktopPage.locator(".chat-empty__suggestions button").first().click();
  await desktopPage.locator(".error-banner").waitFor();
  check(
    typeof desktopPrompt === "string" && /计划/.test(desktopPrompt) && /悉尼/.test(desktopPrompt),
    "desktop example chip submits Chinese text",
    desktopPrompt,
  );
  await desktopPage.getByRole("button", { name: /^聊天/ }).click();
  const desktopBlankChat = desktopPage
    .locator(".chats-panel .history-item")
    .filter({ hasText: "新聊天" })
    .first();
  await desktopBlankChat.waitFor();
  const desktopActionName = await desktopBlankChat
    .locator(".history-item__more")
    .getAttribute("aria-label");
  check(
    desktopActionName === "新聊天的操作",
    "desktop untitled chat action name matches its Chinese title",
    desktopActionName,
  );
  await desktopPage.screenshot({ path: `${out}/desktop-zh.png`, fullPage: true });
  await desktopContext.close();

  const englishContext = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 390, height: 844 },
  });
  const englishPage = await englishContext.newPage();
  let englishPrompt;
  await englishPage.route("**/api/chat", async (route) => {
    englishPrompt = JSON.parse(route.request().postData() ?? "{}").message;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Fixture unavailable" }),
    });
  });
  await englishPage.goto(process.env.BASE_URL ?? "http://localhost:3000");
  await englishPage.locator(".workspace-app").waitFor();
  await englishPage.locator(".chat-empty__suggestions button").first().click();
  await englishPage.locator(".error-banner").waitFor();
  check(
    /^Plan a 4-day trip to Sydney for 2 people from \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}, total budget 4000\.$/.test(
      englishPrompt ?? "",
    ),
    "English Sydney example prompt keeps its original wording",
    englishPrompt,
  );
  await englishPage.getByRole("tab", { name: "Mine", exact: true }).click();
  await englishPage
    .locator(".chats-panel__actions")
    .getByRole("button", { name: "New trip", exact: true })
    .click();
  await englishPage.keyboard.press("Escape");
  await englishPage.getByRole("tab", { name: "Mine", exact: true }).click();
  await englishPage.getByRole("button", { name: "Switch language to 简体中文" }).click();
  await englishPage.waitForFunction(() => document.documentElement.lang === "zh-CN");
  const newTripChat = englishPage.locator(".history-item").filter({ hasText: "新行程" }).first();
  await newTripChat.waitFor();
  const newTripAction = await newTripChat.locator(".history-item__more").getAttribute("aria-label");
  check(
    newTripAction === "新行程的操作",
    "chat started as New trip is titled and labelled in Chinese after switching language",
    newTripAction,
  );
  await englishPage.screenshot({ path: `${out}/phone-en.png`, fullPage: true });
  await englishContext.close();
} catch (error) {
  check(false, "journey completed", String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(checks, null, 2));
}
if (checks.some(({ ok }) => !ok)) process.exit(1);
