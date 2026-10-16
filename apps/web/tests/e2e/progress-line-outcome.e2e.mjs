import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/progress-line-outcome");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const COUNT_LINE = /tool call|subagent|rounds|次工具调用|个子代理|轮/;
const seen = {};

async function openWorkspace(context) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const live = page.getByRole("button", { name: /^Live data/ });
  if (await live.count()) {
    await live.click();
    await page.getByRole("button", { name: /^Mock data/ }).waitFor();
  }
  return { page, errors };
}

const summaries = (page) =>
  page
    .locator(".msg-item--agent .agent-activity")
    .evaluateAll((nodes) =>
      nodes.map(
        (node) => node.querySelector(".thinking-row__summary-text")?.textContent?.trim() ?? "",
      ),
    );

async function send(page, box, text) {
  const before = await page.locator(".msg-item--agent .msg-item__body").count();
  await page.getByRole("textbox", { name: box }).fill(text);
  await page.keyboard.press("Enter");
  await page.locator(".msg-item--agent .msg-item__body").nth(before).waitFor({ timeout: 240_000 });
  await page.waitForTimeout(600);
}

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  const english = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const { page, errors } = await openWorkspace(english);
  await send(page, "Message AI Trip Planner", "Plan a day in Osaka");
  const asked = (await summaries(page)).at(-1) ?? "";
  seen.askedEnglish = asked;
  check(asked !== "Trip plan ready", `a clarifying turn does not say "Trip plan ready" (${asked})`);
  check(
    asked === "Need more details" || COUNT_LINE.test(asked),
    `a clarifying turn says it needs details, or shows its counts (${asked})`,
  );
  await page.screenshot({ path: `${OUT}/asked-en.png` });

  await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      const value = localStorage.getItem(key);
      if (value?.includes('"outcome":"asked"'))
        localStorage.setItem(key, value.replace(/,"outcome":"asked"|"outcome":"asked",?/g, ""));
    }
  });
  await page.reload();
  await page
    .waitForSelector(".msg-item--agent .agent-activity", { timeout: 30_000 })
    .catch(() => {});
  const legacy = (await summaries(page)).at(-1) ?? "";
  seen.legacy = legacy;
  check(
    legacy === "Done" || COUNT_LINE.test(legacy),
    `a saved message with no recorded outcome says "Done" (${legacy || "no activity row"})`,
  );
  check(errors.length === 0, "English: no page errors");
  await english.close();

  const planned = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const plan = await openWorkspace(planned);
  await plan.page.locator(".chat-empty__suggestions button").first().click();
  await plan.page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
  await plan.page.waitForTimeout(600);
  const ready = (await summaries(plan.page)).at(-1) ?? "";
  seen.planned = ready;
  check(
    ready === "Trip plan ready" || COUNT_LINE.test(ready),
    `a planning turn says "Trip plan ready" or shows its counts (${ready})`,
  );
  await plan.page.screenshot({ path: `${OUT}/planned-en.png` });
  check(plan.errors.length === 0, "planned: no page errors");
  await planned.close();

  const chinese = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const zh = await openWorkspace(chinese);
  await zh.page.getByRole("button", { name: "Switch language to 简体中文" }).first().click();
  await zh.page.locator("html[lang='zh-CN']").waitFor({ state: "attached" });
  await send(zh.page, "向 AI 旅行规划助手发送消息", "帮我规划大阪一日游");
  const askedZh = (await summaries(zh.page)).at(-1) ?? "";
  seen.askedChinese = askedZh;
  check(
    askedZh !== "行程方案已就绪",
    `Chinese: a clarifying turn does not say 行程方案已就绪 (${askedZh})`,
  );
  await zh.page.screenshot({ path: `${OUT}/asked-zh.png` });
  check(zh.errors.length === 0, "Chinese: no page errors");
  await chinese.close();
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify({ seen, results }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
