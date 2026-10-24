import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/chat-menu-name-zh");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    locale: "zh-CN",
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "trip.settings.v1",
      JSON.stringify({
        version: 1,
        travel: { homeCity: "", preferences: [] },
        language: "zh",
        dataMode: "mock",
        appearance: "system",
        updatedAt: "2026-10-25T00:00:00Z",
      }),
    );
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const notNow = page.getByRole("button", { name: "暂不" });
  await notNow.waitFor({ timeout: 5000 }).then(
    () => notNow.click(),
    () => {},
  );
  await page.getByRole("button", { name: "墨尔本 → 悉尼 · 5 天" }).click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
  await page.locator(".phone-tabbar").getByRole("tab", { name: /^我的/ }).click();
  const mine = page.locator(".phone-mine");
  const row = mine.locator(".history-item:not(.history-item--trip)").first();
  await row.waitFor();
  const read = () =>
    row.evaluate((item) => ({
      title: item.querySelector(".history-item__title")?.textContent.trim() ?? "",
      meta: item.querySelector(".history-item__meta")?.textContent.trim() ?? "",
      name: item.querySelector(".history-item__more")?.getAttribute("aria-label") ?? "",
    }));
  let seen = await read();
  for (
    let waited = 0;
    waited < 10_000 && !(seen.meta && seen.name.startsWith(seen.title));
    waited += 250
  ) {
    await page.waitForTimeout(250);
    seen = await read();
  }
  const { title, meta, name } = seen;
  await mine.screenshot({ path: `${OUT}/mine-chats.png` });
  check(meta.length > 0, "the chat row shows its trip subtitle", meta);
  check(
    name === `${title}，${meta}的操作`,
    "the ⋮ button name joins title and subtitle with a Chinese comma",
    { name, title, meta },
  );
  check(!name.includes(", "), "the ⋮ button name has no English comma", name);
  check(errors.length === 0, "no page errors", errors);
  await context.close();
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
