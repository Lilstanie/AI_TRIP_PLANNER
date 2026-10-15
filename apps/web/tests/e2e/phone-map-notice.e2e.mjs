import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/phone-map-notice");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const [width, height] of [
    [375, 812],
    [390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));

    await page.goto(BASE);
    await page.locator(".phone-tabbar").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const tab = (name) =>
      page.locator(".phone-tabbar").getByRole("tab", { name: new RegExp(`^${name}`) });

    await tab("Chat").click();
    await page.locator(".chat-empty__suggestions button").first().click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180000 });

    await tab("Map").click();
    const notice = page.locator(".trip-map-canvas--empty .map-placeholder");
    const heading = notice.locator("h2", { hasText: "could not be shown on the map" });
    check(
      await heading.waitFor({ timeout: 20000 }).then(
        () => true,
        () => false,
      ),
      `${width}: the unplaceable destination shows the notice`,
    );

    const sheet = await page.locator(".phone-map-sheet").boundingBox();
    const box = await notice.boundingBox();
    check(sheet && box, `${width}: notice and Day stops sheet are laid out`);
    check(
      box.y >= 0 && box.y + box.height <= sheet.y,
      `${width}: the whole notice sits above the Day stops sheet`,
    );
    await page.screenshot({ path: `${OUT}/${width}.png` });
    check(errors.length === 0, `${width}: no page errors`);
    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
