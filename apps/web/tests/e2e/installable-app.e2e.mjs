import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

const installabilityErrors = async (prepare) => {
  const profile = mkdtempSync(join(tmpdir(), "installable-app-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: process.env.CHANNEL ?? "chromium",
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");
    await prepare?.(page);
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors: errors } = await cdp.send("Page.getInstallabilityErrors");
    return errors.map((error) => error.errorId);
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
};

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  const request = (await browser.newContext()).request;

  const manifestResponse = await request.get(`${BASE}/manifest.webmanifest`);
  check(manifestResponse.ok(), "manifest is served");

  const manifest = await manifestResponse.json().catch(() => ({}));
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

    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForLoadState("networkidle");
    check(
      await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      `${tag}: service worker controls the page`,
    );

    await page.screenshot({ path: `${OUT}/${tag}-01-online.png` });

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

const errors = await installabilityErrors();
check(
  errors.length === 0,
  `desktop: Chrome reports no installability errors${errors.length ? ` (${errors.join(", ")})` : ""}`,
);
const withoutManifest = await installabilityErrors((page) =>
  page.evaluate(() => document.querySelector('link[rel="manifest"]')?.remove()),
);
check(
  withoutManifest.includes("no-manifest"),
  `desktop: the installability probe sees a page without a manifest link (${withoutManifest.join(", ") || "no errors"})`,
);

const failed = results.filter((result) => !result.ok);
writeFileSync(
  `${OUT}/summary.json`,
  `${JSON.stringify({ base: BASE, passed: results.length - failed.length, failed: failed.length, results }, null, 2)}\n`,
);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed; summary in ${OUT}/summary.json`,
);
if (failed.length) process.exit(1);
