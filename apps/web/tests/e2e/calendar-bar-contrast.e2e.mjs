import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EXAMPLE_CHIP_SELECTOR } from "./support/e2e-helpers.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/calendar-bar-contrast");
mkdirSync(OUT, { recursive: true });
const HERE = dirname(fileURLToPath(import.meta.url));
const MIN_CONTRAST = 4.5;

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const channel = (value) => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
const WHITE = [255, 255, 255];

const coverSource = readFileSync(resolve(HERE, "../../components/workspace/TripCover.tsx"), "utf8");
const palettes = [...coverSource.matchAll(/\["(#[0-9a-fA-F]{6})",\s*"(#[0-9a-fA-F]{6})"\]/g)].map(
  (match) => match[1],
);
check(
  palettes.length === 8,
  `all eight cover palettes are read from TripCover (${palettes.length})`,
);
const paletteRatios = palettes.map((stop) => ({ stop, ratio: contrast(hex(stop), WHITE) }));
for (const { stop, ratio } of paletteRatios)
  check(ratio >= MIN_CONTRAST, `white label on the ${stop} bar fill is ${ratio.toFixed(2)}:1`);

const rgb = (css) => {
  const match = css.match(/rgba?\(([^)]+)\)/) ?? css.match(/color\(srgb ([^)]+)\)/);
  if (!match) return undefined;
  const parts = match[1]
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(Number);
  return css.startsWith("color(") ? parts.map((part) => Math.round(part * 255)) : parts;
};

const rendered = [];
const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({
      locale: "en-AU",
      colorScheme: scheme,
      viewport: { width: 1280, height: 800 },
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
    await page.locator(EXAMPLE_CHIP_SELECTOR).first().click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });

    await page.getByRole("button", { name: /^Trips/ }).click();
    await page.getByRole("tab", { name: "Calendar" }).click();
    const bar = page.locator(".trip-calendar__trip").filter({ hasText: /\S/ }).first();
    for (let month = 0; month < 3 && !(await bar.count()); month += 1)
      await page.getByRole("button", { name: "Next month" }).click();
    await bar.waitFor();

    const style = await bar.evaluate((node) => {
      const computed = getComputedStyle(node);
      return { background: computed.backgroundColor, color: computed.color };
    });
    const background = rgb(style.background);
    const text = rgb(style.color);
    const ratio = background && text ? contrast(background, text) : 0;
    rendered.push({ scheme, ...style, ratio });
    check(
      ratio >= MIN_CONTRAST,
      `${scheme}: rendered bar label is ${ratio.toFixed(2)}:1 (${style.color} on ${style.background})`,
    );
    await page.screenshot({ path: `${OUT}/calendar-${scheme}.png` });
    check(errors.length === 0, `${scheme}: no page errors`);
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify({ paletteRatios, rendered, results }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
