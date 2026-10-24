import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/settings-muted-text-contrast", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const BACKDROPS = {
  light: [
    [255, 255, 255],
    [246, 246, 248],
  ],
  dark: [
    [0, 0, 0],
    [28, 28, 30],
  ],
};
const MUTED = ".settings-lead, .settings-hint, .settings-sync, .settings-danger p";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const appearance of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      reducedMotion: "reduce",
      colorScheme: appearance,
      locale: "en-AU",
    });
    await context.addInitScript((appearance) => {
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "", preferences: [] },
          language: "en",
          dataMode: "mock",
          appearance,
          updatedAt: "2026-10-24T00:00:00Z",
        }),
      );
    }, appearance);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const notNow = page.getByRole("button", { name: "Not now" });
    await notNow.waitFor({ timeout: 5000 }).then(
      () => notNow.click(),
      () => {},
    );
    await page.locator(".account-button__profile:visible").first().click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const tabs = dialog.locator(".settings-nav [role=tab]");
    const names = await tabs.allInnerTexts();
    check(names.length >= 5, `${appearance}: every Settings section is reachable`, names);
    for (let index = 0; index < names.length; index += 1) {
      await tabs.nth(index).click();
      await page.waitForTimeout(200);
      const measured = await dialog.evaluate(
        (root, { selector, backdrops }) => {
          const parse = (value) => {
            const srgb = value.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/);
            if (srgb)
              return [
                ...srgb.slice(1, 4).map((part) => Number(part) * 255),
                srgb[4] === undefined ? 1 : Number(srgb[4]),
              ];
            const rgb = value.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/);
            return [...rgb.slice(1, 4).map(Number), rgb[4] === undefined ? 1 : Number(rgb[4])];
          };
          const over = ([r, g, b, a], [br, bg, bb]) => [
            r * a + br * (1 - a),
            g * a + bg * (1 - a),
            b * a + bb * (1 - a),
          ];
          const channel = (value) => {
            const c = value / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          };
          const luminance = ([r, g, b]) =>
            0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
          const ratio = (a, b) => {
            const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
            return (hi + 0.05) / (lo + 0.05);
          };
          const fill = parse(getComputedStyle(root).backgroundColor);
          const body = getComputedStyle(root).color;
          return [...root.querySelectorAll(selector)]
            .filter((node) => node.getClientRects().length > 0 && node.textContent.trim())
            .map((node) => {
              const text = parse(getComputedStyle(node).color);
              const worst = Math.min(
                ...backdrops.map((backdrop) => {
                  const surface = over(fill, backdrop);
                  return ratio(over(text, surface), surface);
                }),
              );
              return {
                text: node.textContent.trim().slice(0, 48),
                ratio: Math.round(worst * 100) / 100,
                alpha: text[3],
                full: getComputedStyle(node).color === body,
              };
            });
        },
        { selector: MUTED, backdrops: BACKDROPS[appearance] },
      );
      const low = measured.filter((entry) => entry.ratio < 4.5);
      check(
        low.length === 0,
        `${appearance} ${names[index]}: muted supporting text is at least 4.5:1`,
        low.length ? low : measured.map((entry) => entry.ratio),
      );
      check(
        measured.every((entry) => !entry.full),
        `${appearance} ${names[index]}: supporting text stays muted, not body colour`,
        measured.filter((entry) => entry.full).map((entry) => entry.text),
      );
    }
    await tabs.first().click();
    await dialog.screenshot({ path: `${OUT}/${appearance}-account.png` });
    check(errors.length === 0, `${appearance}: browser has no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
