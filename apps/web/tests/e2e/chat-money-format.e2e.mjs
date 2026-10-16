import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/chat-money-format");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const MESSAGE = "Plan 3 days in Sydney from 2027-02-01 for 2 adults, budget AUD 2000";
const UNGROUPED = /AUD\s\d{4,}(?:\.\d+)?\b/g;
const AMOUNT = /AUD\s([\d,]+(?:\.\d{2})?)/g;

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const seen = {};
try {
  const context = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
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

  await page.getByRole("textbox", { name: "Message AI Trip Planner" }).fill(MESSAGE);
  await page.keyboard.press("Enter");
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
  await page.waitForTimeout(800);

  const reply = (await page.locator(".msg-item--agent .msg-item__body").last().innerText()).replace(
    /\s+/g,
    " ",
  );
  seen.reply = reply;
  const ungrouped = reply.match(UNGROUPED) ?? [];
  seen.ungrouped = ungrouped;
  check(
    ungrouped.length === 0,
    `the chat reply writes no ungrouped AUD amount (${ungrouped.join(", ") || "none"})`,
  );

  await page.getByRole("button", { name: "Open your trip", exact: true }).click();
  await page.locator(".drawer.is-open .drawer__body").first().waitFor();
  await page.waitForTimeout(600);
  const panel = (await page.locator(".drawer.is-open .drawer__body").first().innerText()).replace(
    /\s+/g,
    " ",
  );
  seen.panel = panel.slice(0, 1500);
  const panelAmounts = [...panel.matchAll(AMOUNT)].map((match) => match[1]);
  const replyAmounts = [...reply.matchAll(AMOUNT)].map((match) => match[1]);
  seen.panelAmounts = panelAmounts;
  seen.replyAmounts = replyAmounts;
  const shared = replyAmounts.filter((amount) => panelAmounts.includes(amount));
  check(
    shared.length > 0,
    `an amount in the reply is spelled exactly as in the Trip panel (${shared.join(", ") || "none"})`,
  );
  await page.screenshot({ path: `${OUT}/trip-panel.png` });
  check(errors.length === 0, "no page errors");
  await context.close();
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify({ seen, results }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
