import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/offline-follow-up",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.CHANNEL });

const send = async (page, text) => {
  const before = await page.locator(".msg-item--agent").count();
  const box = page.locator("textarea").first();
  await box.fill(text);
  await box.press("Enter");
  const turn = page.locator(".msg-item--agent").nth(before);
  await turn.locator(".msg-item__clock").waitFor({ timeout: 90_000 });
  await page.waitForTimeout(500);
  const reply = (await turn.locator(".msg-item__body").innerText()).trim();
  const think = (await turn.locator(".agent-activity").count())
    ? (await turn.locator(".agent-activity").innerText()).trim()
    : "";
  return { reply, think };
};

const journeys = [
  {
    label: "en",
    locale: "en-AU",
    question: "What's the weather like on day 2?",
    noChange: /^Without the AI planner, chat can only change/,
    resize: "Make it 4 people",
  },
  {
    label: "zh",
    locale: "zh-CN",
    question: "第三天加一个法朵表演",
    noChange: /^当前没有 AI 规划/,
    resize: "改成4人",
  },
];

const results = {};
try {
  for (const journey of journeys) {
    const context = await browser.newContext({
      locale: journey.locale,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto(BASE, { waitUntil: "networkidle" });
    const planned = await send(page, "Lisbon, 2027-11-02 to 2027-11-06, 2 people, budget $3000");
    const question = await send(page, journey.question);
    await page.screenshot({ path: resolve(out, `${journey.label}-question.png`) });
    const resized = await send(page, journey.resize);
    const facts = (
      await page
        .locator(".fact-chips")
        .first()
        .innerText()
        .catch(() => "")
    ).trim();
    await page.screenshot({ path: resolve(out, `${journey.label}-resized.png`) });
    results[journey.label] = { planned, question, resized };

    check(
      journey.noChange.test(question.reply),
      `${journey.label}: an unreadable follow-up says what chat can change`,
      question.reply,
    );
    check(
      !/subagent|子代理/i.test(question.think),
      `${journey.label}: no specialists rerun for it`,
      question.think,
    );
    check(
      !journey.noChange.test(resized.reply) && resized.reply !== planned.reply,
      `${journey.label}: a traveller change still replans`,
      resized.reply,
    );
    check(pageErrors.length === 0, `${journey.label}: no page errors`, pageErrors);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(
    resolve(out, "summary.json"),
    JSON.stringify({ base: BASE, checks, results }, null, 2),
  );
}
const failed = checks.filter((item) => !item.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed; evidence in ${out}`);
if (failed.length) process.exit(1);
