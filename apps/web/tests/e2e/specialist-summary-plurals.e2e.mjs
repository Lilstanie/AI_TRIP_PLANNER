import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/specialist-summary-plurals", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const placeholders = (text) => [...new Set(text.match(/[A-Za-z]+\(s\)/g) ?? [])];
const SPECIALIST =
  /(?:option|candidate|leg|choice|guest|day|traveller|request)\(s\)|room\(s\) for/g;
const specialist = (text) => [...new Set(text.match(SPECIALIST) ?? [])];

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const [chip, expected] of [
    [
      "Sydney · 4 days",
      ["1 room, 3 nights in Sydney", "1 room for 2 guests", "4 planning days × 2 travellers"],
    ],
    [
      "Melbourne → Sydney · 5 days",
      ["1 transport option for Melbourne ↔ Sydney", "5 planning days × 2 travellers"],
    ],
  ]) {
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
          updatedAt: "2026-10-23T00:00:00Z",
        }),
      );
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    const streams = [];
    page.on("response", (response) => {
      if (response.url().includes("/api/chat")) streams.push(response.text().catch(() => ""));
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const prompt = page.locator(".location-prompt");
    await prompt.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await prompt.count()) {
      await page.getByRole("button", { name: "Not now" }).click();
      await prompt.waitFor({ state: "detached" });
    }
    await page.getByRole("button", { name: chip }).click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
    await page.waitForTimeout(1500);
    const stream = (await Promise.all(streams)).join("\n");
    check(stream.includes('"complete"'), `${chip}: the plan stream completes`, stream.length);
    check(
      specialist(stream).length === 0,
      `${chip}: no specialist summary, assumption or progress line in the stream has "(s)"`,
      specialist(stream),
    );
    const missing = expected.filter((phrase) => !stream.includes(phrase));
    check(missing.length === 0, `${chip}: counts read naturally for one and many`, missing);

    for (const toggle of await page.locator(".msg-item details > summary").all())
      await toggle.click().catch(() => {});
    const visible = await page.evaluate(() => document.body.innerText);
    check(
      placeholders(visible).length === 0,
      `${chip}: the visible chat and Trip panel show no "(s)"`,
      placeholders(visible),
    );
    await page.screenshot({ path: `${OUT}/${chip.replace(/\W+/g, "-")}.png` });
    check(errors.length === 0, `${chip}: browser has no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
