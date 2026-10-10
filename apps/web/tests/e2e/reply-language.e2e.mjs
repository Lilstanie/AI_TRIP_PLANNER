import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/reply-language");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name) => {
  results.push({ ok, name });
  console.log(`${ok ? "ok" : "FAIL"} ${name}`);
};
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const post = (body) =>
  fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify(body),
  });

const blank = { tripId: "reply-language-e2e", message: "Tokyo", mode: "start" };
const statuses = {
  without: (await post(blank)).status,
  zh: (await post({ ...blank, interfaceLanguage: "zh" })).status,
  fr: (await post({ ...blank, interfaceLanguage: "fr" })).status,
};
check(statuses.without === 200, `a request without the field is accepted (${statuses.without})`);
check(statuses.zh === 200, `interfaceLanguage "zh" is accepted (${statuses.zh})`);
check(statuses.fr === 400, `interfaceLanguage "fr" is rejected (${statuses.fr})`);

const browser = await chromium.launch({ channel: process.env.CHANNEL });
const sent = [];
try {
  const context = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("request", (request) => {
    if (request.url().endsWith("/api/chat") && request.method() === "POST")
      sent.push(JSON.parse(request.postData() ?? "{}"));
  });
  await page.goto(baseUrl);
  await page.locator(".workspace-app").waitFor();
  const sendMessage = async (box, text) => {
    const before = sent.length;
    await page.getByRole("textbox", { name: box }).fill(text);
    await page.keyboard.press("Enter");
    for (let i = 0; i < 50 && sent.length === before; i++) await page.waitForTimeout(100);
    return sent[before];
  };

  const english = await sendMessage("Message AI Trip Planner", "Tokyo");
  check(
    english?.interfaceLanguage === "en",
    `English interface sends "en" (${english?.interfaceLanguage})`,
  );

  await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
  await page.locator("html[lang='zh-CN']").waitFor();
  const chinese = await sendMessage("向 AI 旅行规划助手发送消息", "东京");
  check(
    chinese?.interfaceLanguage === "zh",
    `after switching, the request sends "zh" (${chinese?.interfaceLanguage})`,
  );
  check(chinese?.message === "东京", "the traveller's message is sent unchanged");
  await page.screenshot({ path: `${out}/desktop-zh-after-send.png`, fullPage: true });
  await context.close();
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify({ statuses, sent, results }, null, 2));
}
if (results.some((item) => !item.ok)) process.exit(1);
