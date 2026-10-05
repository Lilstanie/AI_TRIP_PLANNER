// End-to-end check that the site installs as an app on a computer, an iPhone and Android (TWA).
// The service worker only registers in a production build, so run this against `next start`.
//
// Failure inventory this script was written from:
// - the manifest is missing, unlinked, or lacks a name, start URL, standalone display or icons;
// - an icon the manifest names is not served as a PNG, or there is no maskable icon for Android;
// - iPhone gets no apple-touch-icon or theme colour, so Add to Home Screen shows a page snapshot;
// - Chrome reports installability errors, so no Install button appears on a computer;
// - the service worker never controls the page, so offline navigation shows the browser error;
// - offline navigation shows the browser's error page instead of the offline page, or the
//   offline page's icon is not cached and shows as broken;
// - /.well-known/assetlinks.json redirects to sign-in or is not JSON, so Android shows a URL bar.
//
//   pnpm --filter @trip/web build && pnpm --filter @trip/web start   # in another terminal
//   [PLAYWRIGHT=<path to playwright>] node apps/web/tests/e2e/installable-app.e2e.mjs
//
// Writes screenshots and summary.json under output/playwright/installable-app/.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Playwright's offline switch does not reach a service worker's own fetches, so offline is
// simulated by aborting routed requests, which needs service-worker network events turned on.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/installable-app");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const browser = await chromium.launch();
try {
  const request = (await browser.newContext()).request;

  // Manifest and icons.
  const manifestResponse = await request.get(`${BASE}/manifest.webmanifest`);
  check(manifestResponse.ok(), "manifest is served");
  const manifest = await manifestResponse.json();
  check(
    manifest.name === "AI Trip Planner" && manifest.short_name,
    "manifest has a name and short name",
  );
  check(
    manifest.start_url === "/" && manifest.scope === "/",
    "manifest starts at / and covers the whole site",
  );
  check(manifest.display === "standalone", "manifest opens in its own window");
  for (const icon of manifest.icons ?? []) {
    const response = await request.get(new URL(icon.src, BASE).href);
    check(
      response.ok() && response.headers()["content-type"]?.startsWith("image/png"),
      `icon ${icon.src} (${icon.purpose}) is served as PNG`,
    );
  }
  check(
    manifest.icons?.some((icon) => icon.purpose === "maskable"),
    "manifest has a maskable icon for Android",
  );

  // Digital Asset Links for the Android app.
  const links = await request.get(`${BASE}/.well-known/assetlinks.json`, { maxRedirects: 0 });
  check(links.status() === 200, "assetlinks.json is served without a sign-in redirect");
  check(Array.isArray(await links.json().catch(() => null)), "assetlinks.json is a JSON array");

  for (const { width, height, tag } of [
    { width: 1280, height: 800, tag: "desktop" },
    { width: 390, height: 844, tag: "phone" },
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // Head tags that installation reads.
    check(
      (await page.locator('link[rel="manifest"]').count()) === 1,
      `${tag}: page links the manifest`,
    );
    check(
      (await page.locator('link[rel="apple-touch-icon"]').count()) === 1,
      `${tag}: page has an apple-touch-icon`,
    );
    check(
      (await page.locator('meta[name="theme-color"]').count()) > 0,
      `${tag}: page sets a theme colour`,
    );

    // Service worker takes control.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForLoadState("networkidle");
    check(
      await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      `${tag}: service worker controls the page`,
    );

    if (tag === "desktop") {
      const cdp = await context.newCDPSession(page);
      const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
      check(
        installabilityErrors.length === 0,
        `desktop: Chrome reports no installability errors${installabilityErrors.length ? ` (${installabilityErrors.map((e) => e.errorId).join(", ")})` : ""}`,
      );
    }
    await page.screenshot({ path: `${OUT}/${tag}-01-online.png` });

    // Offline navigation falls back to the offline page.
    await context.route("**/*", (route) => route.abort("internetdisconnected"));
    await page.goto(`${BASE}/?offline-check=1`).catch(() => {});
    check(
      await page.getByRole("heading", { name: "You're offline" }).isVisible(),
      `${tag}: offline navigation shows the offline page`,
    );
    check(
      await page.locator("main img").evaluate((img) => img.complete && img.naturalWidth > 0),
      `${tag}: the offline page's icon loads from the cache`,
    );
    await page.screenshot({ path: `${OUT}/${tag}-02-offline.png` });
    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
writeFileSync(
  `${OUT}/summary.json`,
  `${JSON.stringify({ base: BASE, passed: results.length - failed.length, failed: failed.length, results }, null, 2)}\n`,
);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed; summary in ${OUT}/summary.json`,
);
if (failed.length) process.exit(1);
