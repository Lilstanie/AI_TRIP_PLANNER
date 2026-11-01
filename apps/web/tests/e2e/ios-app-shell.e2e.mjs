import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { openMockWorkspace, planSuggestedTrip, settle } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/ios-app-shell", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 TripPlannerIOSApp";
const SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

async function open(browser, { userAgent, scheme }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent,
    colorScheme: scheme,
    reducedMotion: "reduce",
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
        updatedAt: "2026-11-01T00:00:00Z",
      }),
    );
  });
  return { context, page: await context.newPage() };
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

const inputFontSizes = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("textarea, input:not([type=hidden]), select")]
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => parseFloat(getComputedStyle(node).fontSize)),
  );

const browser = await chromium.launch();
try {
  for (const scheme of ["light", "dark"]) {
    const { context, page } = await open(browser, { userAgent: IOS_UA, scheme });
    await openMockWorkspace(page, BASE);
    await settle(page, 600);

    check(
      (await page.evaluate(() => document.documentElement.dataset.shell)) === "ios-app",
      `${scheme}: app user agent marks the page as the iOS app`,
    );
    await shot(page, `${scheme}-1-chat-empty`);

    const sizes = await inputFontSizes(page);
    check(
      sizes.length > 0 && sizes.every((size) => size >= 16),
      `${scheme}: visible fields are at least 16px so iOS does not zoom on focus`,
      sizes,
    );

    const tabbar = await page.evaluate(() => {
      const node = document.querySelector(".phone-tabbar");
      if (!node) return null;
      const style = getComputedStyle(node);
      return {
        filter: style.backdropFilter || style.webkitBackdropFilter,
        radius: style.borderRadius,
      };
    });
    check(tabbar && /blur/.test(tabbar.filter), `${scheme}: tab bar is glass`, tabbar);

    if (scheme === "light") {
      await planSuggestedTrip(page);
      await shot(page, `${scheme}-2-trip`);
      await page.getByRole("tab", { name: /^Chat/ }).click();
      await settle(page, 700);
      await shot(page, `${scheme}-3-chat-planned`);
      await page.getByRole("tab", { name: /^Map/ }).click();
      await settle(page, 1200);
      await shot(page, `${scheme}-4-map`);
    }
    await page.getByRole("tab", { name: /^Mine/ }).click();
    await settle(page, 700);
    await shot(page, `${scheme}-5-mine`);

    await page.goto(`${BASE}/sign-in`);
    await page.locator(".auth-page").waitFor();
    await settle(page, 600);
    await page.addStyleTag({ content: "html { --ios-safe-top: 47px !important; }" });
    const authTop = await page.evaluate(
      () => getComputedStyle(document.querySelector(".auth-page")).paddingTop,
    );
    check(
      parseFloat(authTop) >= 47 + 20,
      `${scheme}: sign-in page clears a 47px status bar`,
      authTop,
    );
    await shot(page, `${scheme}-6-sign-in`);
    await context.close();
  }

  const { context, page } = await open(browser, { userAgent: SAFARI_UA, scheme: "light" });
  await openMockWorkspace(page, BASE);
  check(
    (await page.evaluate(() => document.documentElement.dataset.shell)) === undefined,
    "Safari on iPhone is not marked as the app, so the web layout is unchanged",
  );
  await shot(page, "safari-chat-empty");
  await context.close();
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/result.json`, `${JSON.stringify(results, null, 2)}\n`);
const failed = results.filter((result) => !result.ok);
console.log(
  `${results.length - failed.length}/${results.length} checks passed; screenshots in ${OUT}`,
);
process.exitCode = failed.length ? 1 : 0;
