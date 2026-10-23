import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/stay-summary-plural", process.env.LABEL ?? "run");
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
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    locale: "en-AU",
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "trip.settings.v1",
      JSON.stringify({
        version: 1,
        travel: { homeCity: "", preferences: [] },
        language: "en",
        dataMode: "mock",
        appearance: "system",
        updatedAt: "2026-10-22T00:00:00Z",
      }),
    );
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator("textarea.composer__input").waitFor();
  const prompt = page.locator(".location-prompt");
  await prompt.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await prompt.count()) {
    await page.getByRole("button", { name: "Not now" }).click();
    await prompt.waitFor({ state: "detached" });
  }

  await page.getByRole("button", { name: "Sydney · 4 days" }).click();
  const stay = page.getByText(/ in Sydney · /).first();
  await stay.waitFor({ timeout: 240_000 });
  await page.waitForTimeout(800);
  const text = (await stay.innerText()).trim();

  check(
    text.includes("1 room, 3 nights in Sydney"),
    'the Stay card reads "1 room, 3 nights in Sydney"',
    { text },
  );
  check(!text.includes("(s)"), "the Stay card has no (s) placeholder", { text });
  await page.screenshot({ path: `${OUT}/stay-card.png` });
  check(errors.length === 0, "browser has no page errors", errors);
  await context.close();
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
