import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { openMockWorkspace, settle } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/mac-app-shell", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) TripPlannerMacApp";
const SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 TripPlannerIOSApp";
const PAGE_COLOURS = { light: "rgb(245, 245, 247)", dark: "rgb(0, 0, 0)" };

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

async function open(browser, { userAgent, scheme }) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
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
        updatedAt: "2026-11-04T00:00:00Z",
      }),
    );
  });
  return { context, page: await context.newPage() };
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

const firstPaintShell = (page) =>
  page.evaluate(async () => {
    const response = await fetch("/");
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const script = [...doc.head.querySelectorAll("script")].find((node) =>
      node.textContent.includes("TripPlannerMacApp"),
    );
    if (!script) return null;
    const probe = document.createElement("html");
    new Function("document", script.textContent)({ documentElement: probe });
    return probe.dataset.shell ?? null;
  });

const shellOf = (page) => page.evaluate(() => document.documentElement.dataset.shell ?? null);

const controls = (page) =>
  page.evaluate(() => {
    const visible = (node) => node.getClientRects().length > 0;
    const pick = (selector) => [...document.querySelectorAll(selector)].filter(visible);
    const describe = (node) => {
      const style = getComputedStyle(node);
      return {
        name: (node.getAttribute("aria-label") || node.textContent || "").trim().slice(0, 30),
        cursor: style.cursor,
        select: style.userSelect || style.webkitUserSelect,
      };
    };
    return {
      sidebar: pick(".workspace-sidebar button").map(describe),
      topbar: pick(".workspace-topbar button").map(describe),
      tabs: pick('[role="tab"]').map(describe),
      fields: pick("textarea, input:not([type=hidden])").map(describe),
      overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
      bodyOverscroll: getComputedStyle(document.body).overscrollBehaviorY,
      page: getComputedStyle(document.body).backgroundColor,
    };
  });

const webScrollbarRules = (page) =>
  page.evaluate(() => {
    const probes = ["panel", "chat__stream", "day-strip"].map((name) => {
      const node = document.createElement("div");
      node.className = name;
      document.body.append(node);
      return node;
    });
    const rules = [];
    const walk = (list) => {
      for (const rule of list) {
        if (rule.cssRules) walk(rule.cssRules);
        if (!rule.selectorText?.includes("::-webkit-scrollbar")) continue;
        for (const selector of rule.selectorText.split(/,(?![^(]*\))/)) {
          const base = selector.replace(/::-webkit-scrollbar[\w-]*(:hover)?/g, "").trim();
          if (base && probes.some((probe) => probe.matches(base))) rules.push(selector.trim());
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules);
      } catch {}
    }
    probes.forEach((probe) => probe.remove());
    return rules;
  });

const browser = await chromium.launch();
try {
  for (const scheme of ["light", "dark"]) {
    const { context, page } = await open(browser, { userAgent: MAC_UA, scheme });
    await openMockWorkspace(page, BASE);
    await settle(page, 600);
    check((await shellOf(page)) === "mac-app", `${scheme}: Mac app user agent marks the page`);
    check(
      (await firstPaintShell(page)) === "mac-app",
      `${scheme}: the marker runs from the server HTML head, before hydration`,
    );
    const state = await controls(page);
    const all = [...state.sidebar, ...state.topbar];
    check(
      all.length > 0 && all.every((control) => control.cursor === "default"),
      `${scheme}: sidebar and top-bar buttons use the arrow cursor`,
      all.filter((control) => control.cursor !== "default"),
    );
    check(
      all.every((control) => control.select === "none"),
      `${scheme}: sidebar and top-bar button labels are not selectable`,
      all.filter((control) => control.select !== "none"),
    );
    check(
      state.fields.length > 0 && state.fields.every((field) => field.select !== "none"),
      `${scheme}: text fields stay selectable`,
      state.fields,
    );
    check(
      state.overscroll === "none" && state.bodyOverscroll === "none",
      `${scheme}: the window does not rubber-band`,
      { html: state.overscroll, body: state.bodyOverscroll },
    );
    check(
      state.page === PAGE_COLOURS[scheme],
      `${scheme}: page background is the ${scheme} page colour the title bar takes`,
      state.page,
    );
    await shot(page, `${scheme}-1-chat-empty`);

    if (scheme === "light") {
      const composer = page.locator(".composer textarea").first();
      await composer.click();
      await composer.pressSequentially("Kyoto");
      check(
        (await composer.inputValue()) === "Kyoto",
        "light: the composer takes typed text",
        await composer.inputValue(),
      );
      await composer.fill("");
      await page.locator(".chat-empty__suggestions button").first().click();
      const reply = page.locator(".msg-item--agent .msg-item__body").first();
      await reply.waitFor({ timeout: 180_000 });
      await settle(page, 1500);
      const selected = await reply.evaluate((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return {
          select: getComputedStyle(node).userSelect,
          text: selection.toString().trim().length,
        };
      });
      check(
        selected.select !== "none" && selected.text > 0,
        "light: a chat reply can be selected and copied",
        selected,
      );
      const rules = await webScrollbarRules(page);
      check(
        rules.length === 0,
        "light: the chat stream, panels and day strip use the system scrollbar, not the web one",
        rules,
      );
      await shot(page, "light-2-planned");
      await page.getByRole("button", { name: "Open your trip" }).click();
      await page.getByRole("region", { name: "Trip timeline" }).waitFor({ timeout: 30_000 });
      await settle(page, 700);
      const stop = await page
        .getByRole("region", { name: "Trip timeline" })
        .evaluate((node) => getComputedStyle(node).userSelect);
      check(stop !== "none", "light: itinerary text stays selectable", stop);
      await shot(page, "light-3-trip");
    }
    await context.close();
  }

  {
    const { context, page } = await open(browser, { userAgent: SAFARI_UA, scheme: "light" });
    await openMockWorkspace(page, BASE);
    await settle(page, 600);
    check((await shellOf(page)) === null, "Safari on a Mac is not marked as the app");
    const state = await controls(page);
    check(
      state.sidebar.some((control) => control.cursor === "pointer"),
      "Safari keeps the pointing-hand cursor on web buttons",
      state.sidebar.slice(0, 3),
    );
    check(state.overscroll !== "none", "Safari keeps its overscroll", state.overscroll);
    const rules = await webScrollbarRules(page);
    check(
      rules.some((rule) => rule.includes(".chat__stream")) &&
        rules.some((rule) => rule.includes(".day-strip")),
      "Safari keeps the web scrollbars",
      rules.length,
    );
    await shot(page, "safari-chat-empty");
    await context.close();
  }

  {
    const { context, page } = await open(browser, { userAgent: IOS_UA, scheme: "light" });
    await page.setViewportSize({ width: 390, height: 844 });
    await openMockWorkspace(page, BASE);
    check((await shellOf(page)) === "ios-app", "the iOS app stays marked as the iOS app");
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/result.json`, `${JSON.stringify(results, null, 2)}\n`);
const failed = results.filter((result) => !result.ok);
console.log(
  `${results.length - failed.length}/${results.length} checks passed; screenshots in ${OUT}`,
);
process.exitCode = failed.length ? 1 : 0;
