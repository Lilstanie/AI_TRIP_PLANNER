import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const OUT = resolve("output/playwright/glass-calibration", process.env.LABEL ?? "after");
mkdirSync(OUT, { recursive: true });
const results = [];
const surfaces = [];
const browser = await chromium.launch({ channel: process.env.CHANNEL });
const check = (condition, label) => {
  results.push({ label, passed: !!condition });
  console.log(`${condition ? "ok" : "FAIL"} ${label}`);
};
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

const MIN_CONTRAST = 4.5;
const BUSIEST_BACKDROP = { light: "rgb(160, 160, 160)", dark: "rgb(96, 96, 96)" };

const inspect = (selector, backdrops) => {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:-9999px;width:10px;height:10px;backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-saturate));background:var(--glass-tint);border:1px solid var(--glass-border);box-shadow:var(--glass-shadow);color:var(--page)";
  document.body.append(probe);
  const expected = getComputedStyle(probe);
  const reference = {
    filter: expected.backdropFilter,
    tint: expected.backgroundColor,
    border: expected.borderTopColor,
    page: expected.color,
  };
  probe.remove();

  const parse = (value) => {
    const srgb = value.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/);
    if (srgb)
      return [srgb[1] * 255, srgb[2] * 255, srgb[3] * 255, srgb[4] === undefined ? 1 : +srgb[4]];
    const rgb = value.match(/rgba?\(([^)]+)\)/);
    if (!rgb) return [0, 0, 0, 0];
    const parts = rgb[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  };
  const over = (top, under) => {
    const alpha = top[3];
    return [0, 1, 2].map((i) => top[i] * alpha + under[i] * (1 - alpha)).concat(1);
  };
  const lum = ([r, g, b]) => {
    const [lr, lg, lb] = [r, g, b].map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const [target, pseudo] = selector.split("::");
  const element = [...document.querySelectorAll(target)].find((el) => el.getClientRects().length);
  if (!element) return null;
  const style = getComputedStyle(element, pseudo ? `::${pseudo}` : null);
  const fill = parse(style.backgroundColor);
  const sameMaterial =
    style.backdropFilter === reference.filter &&
    style.backgroundColor === reference.tint &&
    style.borderTopColor === reference.border;
  const solid = style.backdropFilter === "none" && fill[3] === 1;
  const worst = { ratio: Infinity, text: "", color: "" };
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue.trim()) continue;
    const owner = node.parentElement;
    if (!owner.getClientRects().length || getComputedStyle(owner).visibility === "hidden") continue;
    let nested = false;
    for (let up = owner; up && up !== element; up = up.parentElement) {
      if (parse(getComputedStyle(up).backgroundColor)[3] > 0) nested = true;
    }
    if (nested) continue;
    if (owner.closest(":disabled, [aria-disabled='true']")) continue;
    const color = parse(getComputedStyle(owner).color);
    for (const backdrop of backdrops === "fill" ? [] : [parse(reference.page), parse(backdrops)]) {
      const value = ratio(over(color, over(fill, backdrop)), over(fill, backdrop));
      if (value < worst.ratio) {
        worst.ratio = value;
        worst.text = node.nodeValue.trim().slice(0, 40);
        worst.color = getComputedStyle(owner).color;
      }
    }
  }
  return {
    sameMaterial,
    solid,
    alpha: fill[3],
    filter: style.backdropFilter,
    contrast: worst.ratio === Infinity ? null : Math.round(worst.ratio * 100) / 100,
    worstText: worst.text,
    worstColor: worst.color,
  };
};

const measure = async (page, selector, backdrops = BUSIEST_BACKDROP[page.__scheme]) => {
  await page.evaluate(`window.__inspect = ${inspect.toString()}`);
  return page.evaluate(([sel, mid]) => window.__inspect(sel, mid), [selector, backdrops]);
};

const expectGlass = async (page, tag, name, selector) => {
  const report = await measure(page, selector);
  surfaces.push({ tag, name, selector, mode: "glass", report });
  check(!!report, `${tag}: ${name} is on screen`);
  if (!report) return;
  check(report.sameMaterial, `${tag}: ${name} uses the shared glass tokens`);
  check(
    report.contrast === null || report.contrast >= MIN_CONTRAST,
    `${tag}: ${name} text meets ${MIN_CONTRAST}:1 (${report.contrast} on "${report.worstText}" ${report.worstColor})`,
  );
};

try {
  for (const width of [1440, 390]) {
    for (const scheme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 1440 ? 1000 : 844 },
        colorScheme: scheme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => {
        if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico")) {
          errors.push(`${message.text()} (${message.location().url})`);
        }
      });
      await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
      await page.locator(".workspace-app").waitFor();
      const tag = `${width}-${scheme}`;
      page.__scheme = scheme;
      const phone = width < 521;
      await shot(page, `${tag}-workspace`);

      const floating = phone
        ? [
            ["top bar", ".workspace-topbar::before"],
            ["tab bar", ".phone-tabbar"],
          ]
        : [
            ["top bar", ".team-trigger"],
            ["sidebar", ".workspace-sidebar"],
          ];
      for (const [name, selector] of floating) await expectGlass(page, tag, name, selector);

      await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.className = "glass-float";
        probe.id = "glass-float-probe";
        probe.style.cssText = "position:fixed;right:16px;bottom:96px;width:160px;height:48px";
        probe.textContent = "Open items";
        document.body.append(probe);
      });
      await expectGlass(page, tag, "glass-float class", "#glass-float-probe");

      if (!phone) {
        await page.locator(".team-trigger").click();
        await page.locator(".team-popover .team-panel").waitFor();
        await expectGlass(page, tag, "team popover", ".team-popover .team-panel");
        await shot(page, `${tag}-team-popover`);
      }

      const open = [...floating, ["glass-float class", "#glass-float-probe"]];
      if (!phone) open.push(["team popover", ".team-popover .team-panel"]);
      for (const feature of ["prefers-reduced-transparency", "prefers-contrast", "forced-colors"]) {
        const session = await context.newCDPSession(page);
        const value =
          feature === "prefers-contrast"
            ? "more"
            : feature === "forced-colors"
              ? "active"
              : "reduce";
        await session.send("Emulation.setEmulatedMedia", {
          features: [
            { name: "prefers-color-scheme", value: scheme },
            { name: "prefers-reduced-motion", value: "reduce" },
            { name: feature, value },
          ],
        });
        check(
          await page.evaluate(
            ([name, v]) => matchMedia(`(${name}: ${v})`).matches,
            [feature, value],
          ),
          `${tag}: ${feature} emulation active`,
        );
        for (const [name, selector] of open) {
          const ok = await page
            .waitForFunction(
              (sel) => {
                const report = window.__inspect(sel, "fill");
                return !!report && report.solid;
              },
              selector,
              { timeout: 3000 },
            )
            .then(
              () => true,
              () => false,
            );
          check(ok, `${tag}: ${feature} renders ${name} solid`);
          surfaces.push({ tag, name, selector, mode: feature, solid: ok });
        }
        check(
          await page
            .locator(".composer")
            .evaluate((el) => getComputedStyle(el, "::before").display === "none"),
          `${tag}: ${feature} hides sheen`,
        );
        await shot(page, `${tag}-${feature}`);
        await session.detach();
      }
      await page.emulateMedia({
        colorScheme: scheme,
        reducedMotion: "reduce",
        forcedColors: "none",
        contrast: "no-preference",
      });
      if (!phone) {
        await page.keyboard.press("Escape");
        await page.locator(".team-popover").waitFor({ state: "detached" });
      }

      if (!phone) {
        await page.getByRole("button", { name: /Sydney · 4 days/ }).click();
        await page.locator(".fact-chip").nth(1).waitFor();
        await shot(page, `${tag}-planning`);
      } else {
        await page.locator(".phone-topbar__title-button").click();
      }
      const trigger = phone
        ? page.locator('.facts-sheet__row[data-fact="when"]')
        : page.locator(".fact-chip").nth(1);
      if (!phone) await trigger.evaluate((el) => el.setAttribute("data-glass-opener", ""));
      await trigger.click();
      const editor = page.locator(".fact-popover");
      await editor.waitFor();
      await editor.locator(".trip-calendar").waitFor();
      await expectGlass(page, tag, "sheet", ".fact-popover");
      await shot(page, `${tag}-sheet`);
      await page.keyboard.press("Escape");
      await page.locator(".fact-popover").waitFor({ state: "detached" });
      const focusTarget = phone ? ".phone-topbar__title-button" : "[data-glass-opener]";
      check(
        await page
          .waitForFunction(
            (selector) => document.activeElement === document.querySelector(selector),
            focusTarget,
            { timeout: 3000 },
          )
          .then(
            () => true,
            () => false,
          ),
        `${tag}: Escape returns focus to the control that opened the sheet`,
      );
      await page.keyboard.press("Tab");
      check(
        await page.evaluate(() => {
          const style = getComputedStyle(document.activeElement);
          return style.outlineStyle !== "none" || style.boxShadow !== "none";
        }),
        `${tag}: keyboard focus visible`,
      );
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${tag}: no horizontal overflow`,
      );
      check(!errors.length, `${tag}: no console or page errors ${errors.join("; ")}`);
      await context.close();
    }
  }
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, surfaces }, null, 2));
  await browser.close();
}
assert(
  results.length > 0 && results.every((result) => result.passed),
  "Glass calibration checks failed",
);
