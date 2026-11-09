import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/themes");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const THEMES = ["default", "island", "sunset", "forest", "city-night", "oled", "contrast"];
const DARK_ONLY = ["city-night", "oled"];
const ACCENTS = ["blue", "green", "orange", "purple", "pink"];

const settings = (overrides) => ({
  version: 1,
  travel: { homeCity: "", preferences: [] },
  dataMode: "mock",
  appearance: "system",
  updatedAt: "2026-11-09T00:00:00Z",
  ...overrides,
});

async function open(browser, { scheme = "light", saved, shell, width = 1440, height = 1000 }) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: scheme,
    ...(shell === "ios-app" ? { userAgent: "Mozilla/5.0 (iPhone) TripPlannerIOSApp" } : {}),
  });
  await context.addInitScript((saved) => {
    if (saved && !sessionStorage.getItem("themes-e2e-seeded")) {
      localStorage.setItem("trip.settings.v1", JSON.stringify(saved));
      sessionStorage.setItem("themes-e2e-seeded", "1");
    }
    window.__firstPaint = undefined;
    const tick = () => {
      if (!document.body) return requestAnimationFrame(tick);
      window.__firstPaint = {
        page: getComputedStyle(document.documentElement).getPropertyValue("--page").trim(),
        palette: document.documentElement.dataset.palette ?? null,
        accent: document.documentElement.dataset.accent ?? null,
      };
    };
    requestAnimationFrame(tick);
  }, saved);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator(".sidebar-nav, .phone-tabbar").first().waitFor();
  await page.waitForTimeout(400);
  return { context, page };
}

const tokens = (page) =>
  page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name) => style.getPropertyValue(name).trim();
    const probe = document.createElement("i");
    document.body.append(probe);
    const rgb = (value) => {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    };
    const out = {
      scheme: document.documentElement.dataset.scheme,
      theme: document.documentElement.dataset.theme ?? null,
      page: rgb(read("--page")),
      surface: rgb(read("--surface")),
      text: rgb(read("--text")),
      textDim: rgb(read("--text-dim")),
      accent: rgb(read("--accent")),
      accentFill: rgb(read("--accent-fill")),
      onAccent: rgb(read("--on-accent")),
      glassTint: rgb(read("--glass-tint")),
      glassBlur: read("--glass-blur"),
    };
    probe.remove();
    return out;
  });

const channels = (value) =>
  value
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number);
const luminance = (value) => {
  const [r, g, b] = channels(value).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};

const browser = await chromium.launch({ channel: process.env.CHANNEL });
const matrix = [];
try {
  for (const theme of THEMES) {
    for (const scheme of ["light", "dark"]) {
      const { context, page } = await open(browser, {
        scheme,
        saved: settings({ theme, appearance: "system" }),
      });
      const t = await tokens(page);
      const first = await page.evaluate(() => window.__firstPaint);
      const ratios = {
        text: contrast(t.text, t.surface),
        textDimSurface: contrast(t.textDim, t.surface),
        textDimPage: contrast(t.textDim, t.page),
        accentSurface: contrast(t.accent, t.surface),
        onAccent: contrast(t.onAccent, t.accentFill),
      };
      const expectedScheme = DARK_ONLY.includes(theme) ? "dark" : scheme;
      matrix.push({ theme, system: scheme, ...t, ratios });
      check(
        t.scheme === expectedScheme,
        `${theme} on a ${scheme} system renders ${expectedScheme}`,
        t.scheme,
      );
      check(
        Object.values(ratios).every((ratio) => ratio >= 4.5),
        `${theme} (${scheme} system) keeps text and accent at WCAG AA`,
        ratios,
      );
      check(
        first?.palette === (theme === "default" ? null : theme) && first.page !== "",
        `${theme} is applied in the first frame`,
        first,
      );
      if (theme === "contrast")
        check(t.glassBlur === "0px", `high contrast turns glass blur off (${scheme})`, t.glassBlur);
      await page.screenshot({ path: `${OUT}/theme-${theme}-${scheme}.png` });
      await context.close();
    }
  }

  const forced = await open(browser, {
    scheme: "light",
    saved: settings({ theme: "oled", appearance: "light" }),
  });
  const forcedTokens = await tokens(forced.page);
  check(
    forcedTokens.scheme === "dark" && forcedTokens.theme === "dark",
    "OLED black with the Light appearance still renders dark",
    { scheme: forcedTokens.scheme, theme: forcedTokens.theme },
  );
  await forced.context.close();

  for (const accent of ACCENTS) {
    for (const scheme of ["light", "dark"]) {
      const base = await open(browser, { scheme, saved: settings({ theme: "sunset" }) });
      const baseTokens = await tokens(base.page);
      await base.context.close();
      const { context, page } = await open(browser, {
        scheme,
        saved: settings({ theme: "sunset", accent }),
      });
      const t = await tokens(page);
      check(
        t.accent !== baseTokens.accent &&
          contrast(t.accent, t.surface) >= 4.5 &&
          contrast(t.onAccent, t.accentFill) >= 4.5,
        `${accent} accent overrides the sunset accent at AA (${scheme})`,
        { accent: t.accent, fill: t.accentFill },
      );
      if (scheme === "light") await page.screenshot({ path: `${OUT}/accent-${accent}.png` });
      await context.close();
    }
  }

  for (const scheme of ["light", "dark"]) {
    const ios = await open(browser, {
      scheme,
      shell: "ios-app",
      width: 390,
      height: 844,
      saved: settings({ theme: "contrast" }),
    });
    const t = await tokens(ios.page);
    check(
      t.glassBlur === "0px" && t.glassTint === t.surface,
      `high contrast beats the iOS shell glass (${scheme})`,
      { blur: t.glassBlur, tint: t.glassTint, surface: t.surface },
    );
    await ios.page.screenshot({ path: `${OUT}/ios-contrast-${scheme}.png` });
    await ios.context.close();
  }

  const { context, page } = await open(browser, { scheme: "light", saved: settings({}) });
  await page.locator('button[aria-label="Open account menu"]:visible').first().click();
  await page.getByRole("menuitem", { name: "Account settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Change Theme" }).click();
  await dialog
    .getByRole("group", { name: "Theme" })
    .getByRole("button", { name: "City night" })
    .click();
  await page.waitForTimeout(300);
  const picked = await tokens(page);
  check(
    picked.scheme === "dark",
    "picking City night in Settings switches to dark at once",
    picked.scheme,
  );
  check(
    (await dialog.getByRole("button", { name: "Change Appearance" }).count()) === 0,
    "a dark-only theme offers no appearance choice",
  );
  await dialog.getByRole("button", { name: "Change Accent colour" }).click();
  await dialog
    .getByRole("group", { name: "Accent colour" })
    .getByRole("button", { name: "Green" })
    .click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/settings-picker.png` });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const reloaded = await page.evaluate(() => ({
    palette: document.documentElement.dataset.palette,
    accent: document.documentElement.dataset.accent,
  }));
  check(
    reloaded.palette === "city-night" && reloaded.accent === "green",
    "the picked theme and accent survive a reload",
    reloaded,
  );
  await context.close();
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify(
    { base: BASE, passed: results.length - failed.length, failed: failed.length, results, matrix },
    null,
    2,
  ),
);
console.log(`${results.length - failed.length}/${results.length} passed; artifacts in ${OUT}`);
if (failed.length) process.exitCode = 1;
