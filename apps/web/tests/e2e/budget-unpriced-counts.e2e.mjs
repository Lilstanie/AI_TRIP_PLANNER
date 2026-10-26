import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/budget-unpriced-counts");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const plain = (text) => text.replace(/\s+/g, " ").trim();
const count = (text, pattern) => Number(text.match(pattern)?.[1] ?? 0);

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const seen = {};
try {
  for (const locale of ["en-AU", "zh-CN"]) {
    const zh = locale === "zh-CN";
    const context = await browser.newContext({
      locale,
      viewport: { width: 390, height: 800 },
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
    await page.locator(".chat-empty__suggestions button").first().click();
    await page
      .locator(".msg-item--agent .msg-item__body")
      .filter({ hasText: zh ? "预计总额" : "Estimated total" })
      .first()
      .waitFor({ timeout: 240_000 });
    await tab(zh ? "行程" : "Trip").click();
    const card = page.locator(".trip-panel__budget-summary");
    await card.waitFor();
    await card.locator("summary").click();
    const rows = (await card.locator(".trip-panel__budget-breakdown > li").allInnerTexts()).map(
      plain,
    );
    const notes = (await card.locator(".trip__budget-note").allInnerTexts()).map(plain);
    await page.screenshot({ path: `${OUT}/${locale}.png`, fullPage: true });
    seen[locale] = { rows, notes };

    const rowCount = zh ? /(\d+) 项未定价/ : /(\d+) unpriced/;
    const [meals, activities] = [zh ? "餐饮" : "Meals", zh ? "活动" : "Activities"].map(
      (label) => rows.find((row) => row.startsWith(label)) ?? "",
    );
    const transport = rows.find((row) => row.startsWith(zh ? "交通" : "Transport")) ?? "";
    const transportUnpriced = count(transport, rowCount);
    const transportWithoutEstimate =
      transportUnpriced === 0 && /Not costed|未计价/.test(transport) ? 1 : 0;
    const noteStops = notes.map((note) => count(note, /[(（](\d+)/)).find(Boolean) ?? 0;
    check(meals, `${locale}: the Meals row is shown`);
    check(
      count(meals, rowCount) === 0,
      `${locale}: restaurant ideas are not counted as unpriced meals (${meals})`,
    );
    check(
      count(activities, rowCount) + transportUnpriced + transportWithoutEstimate === noteStops,
      `${locale}: activity and transport category counts match the Not included note (${count(activities, rowCount)} + ${transportUnpriced + transportWithoutEstimate} vs ${noteStops})`,
    );
    const rowTotal =
      rows.reduce((sum, row) => sum + count(row, rowCount), 0) + transportWithoutEstimate;
    check(
      rowTotal === noteStops,
      `${locale}: every unpriced count in the rows is explained by the notes (${rowTotal} vs ${noteStops})`,
    );
    check(errors.length === 0, `${locale}: no page errors`);
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify({ results, seen }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
