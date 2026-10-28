import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, settle } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const labelName = process.env.EVIDENCE_LABEL ?? "after";
const root = resolve("output/playwright/trajectory-restyle");
const out = resolve(root, labelName);
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const COPY = {
  en: {
    locale: "en-AU",
    tab: "Trajectory",
    full: "Full view",
    simple: "Simple view",
    details: "Event details",
    chat: /^Chat/,
  },
  zh: {
    locale: "zh-CN",
    tab: "轨迹",
    full: "完整视图",
    simple: "简单视图",
    details: "事件详情",
    chat: /^聊天/,
  },
};
const LONG = `${"Plan a calm week in Kyoto with slow mornings and long dinners. ".repeat(24)}${"x".repeat(90)}`;

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const strings = {};

const probes = (page) =>
  page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const rgba = (css) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const over = (top, bottom) => {
      const a = top[3] + bottom[3] * (1 - top[3]);
      return [0, 1, 2]
        .map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / (a || 1))
        .concat(a);
    };
    const background = (node) => {
      let acc = [0, 0, 0, 0];
      for (let n = node; n; n = n.parentElement) {
        acc = over(acc, rgba(getComputedStyle(n).backgroundColor));
        if (acc[3] >= 0.999) break;
      }
      return acc[3] >= 0.999
        ? acc
        : over(acc, rgba(getComputedStyle(document.body).backgroundColor));
    };
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (node, pseudo) => {
      const text = rgba(getComputedStyle(node, pseudo).color);
      const bg = background(node);
      const fg = over(text, bg);
      const [x, y] = [lum(fg), lum(bg)];
      return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
    };
    const scope = document.querySelector(".trajectory-tab");
    if (!scope) return { missing: true };
    const first = (selector) => scope.querySelector(selector);
    const targets = {
      modeButton: first('[data-trajectory-modebar] button[aria-pressed="false"]'),
      modeActive: first('[data-trajectory-modebar] button[aria-pressed="true"]'),
      summary: first("[data-simple-summary]"),
      result: first("[data-simple-result]"),
      toolbarAction: first('[role="toolbar"] button'),
      search: first('[role="toolbar"] input'),
      tab: first('[role="tab"]'),
      th: first("th"),
      location: first('aside[aria-label] [class*="detailsLocation"]'),
    };
    const contrast = {};
    for (const [name, node] of Object.entries(targets))
      if (node) contrast[name] = ratio(node, name === "search" ? "::placeholder" : undefined);
    const blur = (node) => {
      if (!node) return null;
      const style = getComputedStyle(node);
      const filter = style.backdropFilter || style.webkitBackdropFilter || "none";
      return { blurred: /blur/.test(filter), fillAlpha: rgba(style.backgroundColor)[3] };
    };
    return {
      contrast,
      glass: {
        modebar: blur(first("[data-trajectory-modebar]")),
        toolbar: blur(first('[role="toolbar"]')),
        inspector: blur(document.querySelector("aside[aria-label]")),
        simpleRow: blur(first("[data-simple-toggle]")),
        ledgerRow: blur(first("tr[data-record-index]")),
      },
    };
  });

const overflows = (page) =>
  page.evaluate(() => {
    const scope =
      document.querySelector("dialog.phone-trajectory[open]") ??
      document.querySelector(".trajectory-tab");
    const page = document.documentElement.scrollWidth - window.innerWidth;
    const inner = scope
      ? [scope, ...scope.querySelectorAll("*")].filter((n) => {
          const scrolls = /auto|scroll/.test(getComputedStyle(n).overflowX);
          return (
            scrolls &&
            n.scrollWidth > n.clientWidth + 1 &&
            !n.matches("[data-trajectory-scroll], [role='region'] *")
          );
        }).length
      : -1;
    return { page, inner };
  });

async function prepare(browserContext, locale, viewport, phone) {
  const page = await browserContext.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));
  await openMockWorkspace(page, base);
  if (phone) await page.locator(".workspace-app[data-phone]").waitFor();
  return { page, errors };
}

async function openTrajectory(page, copy, phone) {
  if (phone) {
    await page.locator(".phone-topbar__team").tap();
    await page.locator("dialog.phone-trajectory[open]").waitFor();
  } else {
    await page.getByRole("tab", { name: copy.tab, exact: true }).click();
  }
  await settle(page, 500);
}

async function closeTrajectory(page, phone) {
  if (phone) await page.locator(".phone-trajectory__close").tap();
}

async function walk(locale, width, height) {
  const copy = COPY[locale];
  const phone = width <= 520;
  const label = `${locale}-${width}`;
  const context = await browser.newContext({
    locale: copy.locale,
    viewport: { width, height },
    deviceScaleFactor: phone ? 2 : 1,
    hasTouch: phone,
    isMobile: phone,
    reducedMotion: "reduce",
  });
  const { page, errors } = await prepare(context, locale, { width, height }, phone);
  const press = (locator) => (phone ? locator.tap() : locator.click());

  await openTrajectory(page, copy, phone);
  await settle(page, 300);
  await page.screenshot({ path: `${out}/${label}-empty.png` });
  const emptyFlow = await overflows(page);
  check(
    emptyFlow.page <= 0,
    `${label}: the empty Trajectory does not scroll the page sideways`,
    emptyFlow,
  );
  check(
    (await page.locator(".trajectory-empty, [data-trajectory-phone], .trajectory-tab").count()) > 0,
    `${label}: the empty Trajectory renders`,
  );
  await closeTrajectory(page, phone);

  if (phone) await page.getByRole("tab", { name: copy.chat }).click();
  else
    await page
      .getByRole("tab", { name: locale === "en" ? "Conversation" : "对话", exact: true })
      .click()
      .catch(() => undefined);
  await page.locator(".chat-empty__suggestions button").first().waitFor({ timeout: 60_000 });
  await press(page.locator(".chat-empty__suggestions button").first());
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
  await settle(page, 1200);
  await openTrajectory(page, copy, phone);

  const simple = page.locator("[data-trajectory-simple]");
  await simple.waitFor({ timeout: 15_000 });
  await press(simple.locator("[data-simple-toggle]").first());
  await settle(page, 300);
  await page.screenshot({ path: `${out}/${label}-simple.png` });
  const simpleFlow = await overflows(page);
  check(
    simpleFlow.page <= 0 && simpleFlow.inner === 0,
    `${label}: the simple list does not scroll sideways`,
    simpleFlow,
  );
  const rowHeights = await simple
    .locator("[data-simple-toggle]")
    .evaluateAll((nodes) => nodes.map((n) => Math.round(n.getBoundingClientRect().height)));
  check(
    rowHeights.every((h) => h >= (phone ? 44 : 40)),
    `${label}: simple rows keep their touch height`,
    rowHeights,
  );
  strings[`${label}-simple`] = await page.locator(".trajectory-tab").first().innerText();

  const view = page.getByRole("group", { name: /^(Trajectory view|轨迹视图)$/ });
  const modes = await view
    .locator("button")
    .evaluateAll((nodes) => nodes.map((n) => Math.round(n.getBoundingClientRect().height)));
  check(
    modes.length === 2 && modes.every((h) => h >= (phone ? 44 : 28)),
    `${label}: the view switch has two usable buttons`,
    modes,
  );

  const measured = await probes(page);
  const light = measured.contrast ?? {};
  check(
    Object.keys(light).length >= 4 && Object.values(light).every((value) => value >= 4.5),
    `${label}: simple view text has AA contrast`,
    light,
  );
  check(
    measured.glass?.modebar?.blurred === true,
    `${label}: the view switch is a glass surface`,
    measured.glass?.modebar,
  );
  check(
    measured.glass?.simpleRow?.blurred === false,
    `${label}: simple rows are not glass`,
    measured.glass?.simpleRow,
  );

  await press(view.getByRole("button", { name: copy.full, exact: true }));
  await page.locator("tr[data-record-index]").first().waitFor({ timeout: 15_000 });
  await settle(page, 400);
  await page.screenshot({ path: `${out}/${label}-full.png` });
  const fullFlow = await overflows(page);
  check(fullFlow.page <= 0, `${label}: the ledger does not scroll the page sideways`, fullFlow);
  strings[`${label}-full`] = await page.locator(".trajectory-tab").first().innerText();

  const full = await probes(page);
  check(
    Object.keys(full.contrast ?? {}).length >= 4 &&
      Object.values(full.contrast).every((value) => value >= 4.5),
    `${label}: full view text has AA contrast`,
    full.contrast,
  );
  if (!phone) {
    check(
      full.glass.toolbar?.blurred === true,
      `${label}: the toolbar is a glass surface`,
      full.glass.toolbar,
    );
    check(
      full.glass.ledgerRow?.blurred === false,
      `${label}: ledger rows are not glass`,
      full.glass.ledgerRow,
    );
    const search = page.getByRole("searchbox").first();
    await search.fill("a");
    await settle(page, 400);
    check(
      (await page.locator("[data-search-count]").count()) === 1,
      `${label}: search still counts hits`,
    );
    await search.fill("");
  }

  await press(page.locator("tr[data-record-index]").nth(2));
  const aside = page.getByRole("complementary", { name: copy.details });
  await aside.waitFor({ timeout: 8000 });
  await settle(page, 400);
  await page.screenshot({ path: `${out}/${label}-inspector.png` });
  const inspectorFlow = await overflows(page);
  check(
    inspectorFlow.page <= 0,
    `${label}: the inspector does not scroll the page sideways`,
    inspectorFlow,
  );
  const inspected = await probes(page);
  check(
    inspected.glass.inspector?.blurred === true,
    `${label}: the inspector is a glass surface`,
    inspected.glass.inspector,
  );
  check(
    Object.values(inspected.contrast ?? {}).every((value) => value >= 4.5),
    `${label}: inspector text has AA contrast`,
    inspected.contrast,
  );

  if (!phone && locale === "en") {
    await page.emulateMedia({ colorScheme: "dark" });
    await settle(page, 300);
    await page.screenshot({ path: `${out}/${label}-inspector-dark.png` });
    const dark = await probes(page);
    check(
      Object.values(dark.contrast ?? {}).every((value) => value >= 4.5),
      `${label}: dark inspector text has AA contrast`,
      dark.contrast,
    );
    await aside.getByRole("button", { name: /^(Close details|关闭详情)$/ }).click();
    const darkFull = await probes(page);
    check(
      Object.values(darkFull.contrast ?? {}).every((value) => value >= 4.5),
      `${label}: dark full view text has AA contrast`,
      darkFull.contrast,
    );
    await page.emulateMedia({ colorScheme: "light" });

    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
    });
    await settle(page, 300);
    const supported = await page.evaluate(
      () => matchMedia("(prefers-reduced-transparency: reduce)").matches,
    );
    check(supported, `${label}: reduced transparency is emulated`);
    await press(page.locator("tr[data-record-index]").nth(2));
    await aside.waitFor({ timeout: 8000 });
    const solid = await probes(page);
    const surfaces = ["toolbar", "inspector"].map((key) => solid.glass[key]);
    check(
      surfaces.every((item) => item && item.blurred === false && item.fillAlpha >= 0.999),
      `${label}: reduced transparency makes the glass surfaces solid`,
      surfaces,
    );
    await page.screenshot({ path: `${out}/${label}-reduced-transparency.png` });
    await cdp.send("Emulation.setEmulatedMedia", { features: [] });
  }

  check(errors.length === 0, `${label}: no page errors`, errors);
  await context.close();
}

async function stress() {
  const copy = COPY.en;
  const context = await browser.newContext({
    locale: copy.locale,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const { page, errors } = await prepare(context, "en", { width: 1440, height: 900 }, false);
  await page.getByRole("textbox", { name: "Message AI Trip Planner" }).fill(LONG);
  await page.keyboard.press("Enter");
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
  await settle(page, 1200);
  await openTrajectory(page, copy, false);
  const simple = page.locator("[data-trajectory-simple]");
  await simple.waitFor({ timeout: 15_000 });
  const row = simple.locator("[data-simple-turn]").first();
  const geometry = await row.evaluate((node) => ({
    row: Math.round(node.getBoundingClientRect().height),
    wide: node.scrollWidth - node.clientWidth,
    list: node.parentElement.scrollWidth - node.parentElement.clientWidth,
  }));
  check(
    geometry.wide <= 1 && geometry.list <= 1 && geometry.row <= 120,
    "very long turn: the row stays inside the list and short",
    geometry,
  );
  await page.screenshot({ path: `${out}/en-1440-long-turn.png` });
  const flow = await overflows(page);
  check(flow.page <= 0, "very long turn: the page does not scroll sideways", flow);
  await page.getByRole("button", { name: copy.full, exact: true }).click();
  await page.locator("tr[data-record-index]").first().waitFor({ timeout: 15_000 });
  await page.setViewportSize({ width: 800, height: 900 });
  await settle(page, 600);
  await page.screenshot({ path: `${out}/en-800-narrow-before-open.png` });
  await page.locator("tr[data-record-index]").nth(1).click();
  await page.getByRole("complementary", { name: copy.details }).waitFor({ timeout: 8000 });
  await settle(page, 400);
  await page.screenshot({ path: `${out}/en-800-narrow.png` });
  const narrow = await page.evaluate(() => {
    const tab = document.querySelector(".trajectory-tab");
    const box = tab.getBoundingClientRect();
    const out = [...tab.querySelectorAll("[role='toolbar'], aside, [role='region']")].filter(
      (n) => {
        const r = n.getBoundingClientRect();
        return r.right > box.right + 1 || r.left < box.left - 1;
      },
    );
    return { page: document.documentElement.scrollWidth - innerWidth, escaped: out.length };
  });
  check(
    narrow.page <= 0 && narrow.escaped === 0,
    "narrow container: toolbar, timeline and inspector stay inside the panel",
    narrow,
  );
  check(errors.length === 0, "stress: no page errors", errors);
  await context.close();
}

try {
  for (const [locale, width, height] of [
    ["en", 1440, 1000],
    ["zh", 1440, 1000],
    ["en", 390, 844],
    ["zh", 390, 844],
  ])
    await walk(locale, width, height);
  await stress();

  writeFileSync(`${out}/strings.json`, JSON.stringify(strings, null, 2));
  const beforeStrings = resolve(root, "before/strings.json");
  if (labelName !== "before" && existsSync(beforeStrings)) {
    const before = JSON.parse(readFileSync(beforeStrings, "utf8"));
    const changed = Object.keys(strings).filter((key) => before[key] !== strings[key]);
    check(
      changed.length === 0,
      "the Trajectory shows the same strings as before the restyle",
      changed,
    );
  }
} catch (error) {
  check(false, "the walkthrough completed", String(error).split("\n").slice(0, 3).join(" "));
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
  if (checks.some((item) => !item.ok)) process.exitCode = 1;
}
