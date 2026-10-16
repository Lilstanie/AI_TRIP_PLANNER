import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/fact-chips-wheel-scroll");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const measured = {};
try {
  const context = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1024, height: 768 },
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
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
  await page.waitForTimeout(600);

  const row = page.locator(".fact-chips__scroller");
  const state = () =>
    row.evaluate((node) => ({
      scrollLeft: Math.round(node.scrollLeft),
      overflow: node.scrollWidth - node.clientWidth,
      fade: node.dataset.fade ?? "",
      mask: getComputedStyle(node).maskImage || "",
    }));

  await row.evaluate((node) => (node.scrollLeft = 0));
  await page.waitForTimeout(200);
  const start = await state();
  measured.start = start;
  check(start.overflow > 1, `the chip row overflows at 1024 px (by ${start.overflow}px)`);
  check(start.fade === "end", `at the start the row marks hidden chips at the end (${start.fade})`);
  check(start.mask.includes("56px"), "the edge fade is 56px wide");
  await page.screenshot({ path: `${OUT}/start.png` });

  const box = await row.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(300);
  const after = await state();
  measured.afterOneNotch = after;
  check(
    after.scrollLeft > 0,
    `a vertical wheel over the row scrolls it sideways (${after.scrollLeft}px)`,
  );

  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(300);
  const end = await state();
  measured.end = end;
  check(
    end.scrollLeft >= end.overflow - 1,
    `more wheel reaches the end of the row (${end.scrollLeft}px)`,
  );
  check(end.fade === "start", `at the end the row marks hidden chips at the start (${end.fade})`);
  const preferences = await page.locator(".fact-chip--preferences").boundingBox();
  const rowBox = await row.boundingBox();
  check(
    preferences && preferences.x + preferences.width <= rowBox.x + rowBox.width + 1,
    "Preferences is fully inside the row after scrolling",
  );
  await page.screenshot({ path: `${OUT}/end.png` });

  await page.mouse.wheel(0, -4000);
  await page.waitForTimeout(300);
  check((await state()).scrollLeft === 0, "a wheel back up returns the row to the start");

  const stream = page.locator(".chat__stream").first();
  const streamBox = await stream.boundingBox();
  await page.mouse.move(streamBox.x + streamBox.width / 2, streamBox.y + streamBox.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  check((await state()).scrollLeft === 0, "a wheel over the chat does not move the chip row");

  check(errors.length === 0, "no page errors");
  await context.close();
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify({ measured, results }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
