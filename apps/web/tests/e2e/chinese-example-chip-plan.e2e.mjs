import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/chinese-example-chip-plan", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const COPY = {
  en: { notNow: "Not now", trip: /^Trip/, day: /^Day \d+\b/ },
  zh: { notNow: "暂不", trip: /^行程/, day: /^第\s*\d+\s*天/ },
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const [language, chipIndex] of [
    ["zh", 0],
    ["zh", 1],
    ["zh", 2],
    ["zh", 3],
    ["en", 0],
  ]) {
    const copy = COPY[language];
    const tag = `${language} chip ${chipIndex + 1}`;
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
      locale: language === "zh" ? "zh-CN" : "en-AU",
    });
    await context.addInitScript((language) => {
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "", preferences: [] },
          language,
          dataMode: "mock",
          appearance: "system",
          updatedAt: "2026-10-23T00:00:00Z",
        }),
      );
    }, language);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const notNow = page.getByRole("button", { name: copy.notNow });
    await notNow.waitFor({ timeout: 5000 }).then(
      () => notNow.click(),
      () => {},
    );
    const chip = page.locator(".chat-empty__suggestions button").nth(chipIndex);
    const label = (await chip.innerText()).trim();
    const days = Number(label.match(/(\d+)\s*(?:天|days?)/)?.[1]);
    const route = label.split("·")[0].split("→");
    const place = route.pop().trim();
    const origin = route.length ? route[0].trim() : undefined;
    await chip.click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy.trip }).click();
    const panel = page.locator("#phone-panel-trip");
    const dayTabs = panel.getByRole("tab", { name: copy.day });
    const planned = await dayTabs
      .first()
      .waitFor({ timeout: 60_000 })
      .then(() => true)
      .catch(() => false);
    const reply = await page.locator(".msg-item--agent .msg-item__body").last().innerText();
    check(planned, `${tag} ("${label}") produces a plan in the Trip tab`, reply.slice(0, 160));
    if (planned) {
      check(
        (await dayTabs.count()) === days,
        `${tag} the plan has ${days} days`,
        await dayTabs.count(),
      );
      const title = await page.locator(".phone-topbar__title-text").innerText();
      check(
        title
          .split("·")[0]
          .trim()
          .replace(" & ", language === "zh" ? "和" : " & ") === place,
        `${tag} the trip title names exactly "${place}"`,
        title,
      );
      if (origin)
        check(
          reply.includes(`${origin} ↔`) || reply.includes(`${origin} →`),
          `${tag} the transport line departs from "${origin}"`,
          reply.slice(0, 200),
        );
    }
    await page.screenshot({ path: `${OUT}/${language}-${chipIndex + 1}.png` });
    check(errors.length === 0, `${tag} browser has no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
