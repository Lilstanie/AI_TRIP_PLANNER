import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/reply-cost-line");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const CASES = [
  {
    name: "542-sydney-no-origin",
    locale: "en-AU",
    message:
      "Plan a 4-day trip to Sydney for 2 people from 2026-11-12 to 2026-11-15, total budget 4000.",
  },
  {
    name: "475-sydney-tight-budget",
    locale: "en-AU",
    message: "Sydney 2 days from 2026-12-01, 2 adults, budget AUD 100 total",
  },
  {
    name: "476-tokyo",
    locale: "en-AU",
    message: "Plan 3 days in Tokyo for 2 adults, budget AUD 3000, from 2027-03-10",
  },
  {
    name: "zh-sydney",
    locale: "zh-CN",
    suggestion: true,
  },
];

const plain = (text) => text.replace(/\s+/g, " ").trim();
const amounts = (text) => text.match(/(?:AUD|CNY|USD|JPY) [\d,]+(?:\.\d+)?/g) ?? [];

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const seen = {};
try {
  for (const item of CASES) {
    const zh = item.locale === "zh-CN";
    const context = await browser.newContext({
      locale: item.locale,
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(BASE);
    await page.locator(".phone-tabbar").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const tab = (name) =>
      page.locator(".phone-tabbar").getByRole("tab", { name: new RegExp(`^${name}`) });

    await tab(zh ? "聊天" : "Chat").click();
    if (item.suggestion) await page.locator(".chat-empty__suggestions button").first().click();
    else {
      await page.getByRole("textbox").last().fill(item.message);
      await page.getByRole("button", { name: "Send" }).click();
    }
    const replyLocator = page
      .locator(".msg-item--agent .msg-item__body")
      .filter({ hasText: zh ? "预计总额" : "Estimated total" })
      .first();
    const replied = await replyLocator
      .waitFor({ timeout: 240_000 })
      .then(() => true)
      .catch(() => false);
    if (!replied) {
      await page.screenshot({ path: `${OUT}/${item.name}-no-reply.png` });
      check(false, `${item.name}: a reply with the cost sentence arrives`);
      await context.close();
      continue;
    }
    const reply = plain(await replyLocator.innerText());
    await page.screenshot({ path: `${OUT}/${item.name}-reply.png` });

    await tab(zh ? "行程" : "Trip").click();
    const card = page.locator(".trip-panel__budget-summary");
    await card.waitFor();
    const total = plain(await card.locator(".trip__budget strong").innerText());
    const delta = plain(await card.locator(".trip__budget-delta").innerText());
    const notes = (await card.locator(".trip__budget-note").allInnerTexts()).map(plain);
    await page.screenshot({ path: `${OUT}/${item.name}-trip.png` });
    seen[item.name] = { reply, total, delta, notes };

    check(reply.includes(total), `${item.name}: reply quotes the card total ${total}`);
    for (const amount of amounts(delta))
      check(reply.includes(amount), `${item.name}: reply quotes the card's budget gap ${amount}`);
    const overCard = /over|超出/.test(delta);
    check(
      overCard === (zh ? /超出/.test(reply) : /\bover your\b/.test(reply)),
      `${item.name}: reply and card agree on over or under budget`,
    );
    const transportNote = notes.some((note) => /transport|交通/.test(note));
    check(
      transportNote === (zh ? /未定价的交通/.test(reply) : /transport without a price/.test(reply)),
      `${item.name}: transport is excluded in the reply exactly when the card excludes it`,
    );
    const stopCount = notes.map((note) => note.match(/[(（](\d+)/)).find(Boolean);
    const count = stopCount ? Number(stopCount[1]) : 0;
    check(
      count === 0
        ? !/without a published price|未公布价格/.test(reply)
        : zh
          ? reply.includes(`${count} 个未公布价格的停靠点`)
          : new RegExp(`\\b${count} stops? without a published price`).test(reply),
      `${item.name}: reply names the card's ${count} unpriced stops`,
    );
    check(
      !/\bfree\b|comfortably|flight portion|免费/i.test(reply),
      `${item.name}: reply makes no free, comfortable or flight-included claim`,
    );
    check(
      zh ? !/Estimated total|Not included/.test(reply) : !/预计总额/.test(reply),
      `${item.name}: cost sentence is in the reply language`,
    );
    check(amounts(reply).length > 0, `${item.name}: reply carries an amount`);
    check(errors.length === 0, `${item.name}: no page errors`);
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify({ results, seen }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
