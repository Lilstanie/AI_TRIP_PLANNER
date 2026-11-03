import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { startExamplePlan } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/phone-finish", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);

const COPY = {
  en: { title: "Planning progress", toCheck: "To check", trip: /^Trip/, mine: /^Mine/ },
  zh: { title: "规划进度", toCheck: "待确认", trip: /^行程/, mine: /^我的/ },
};

async function open(browser, { width, height, language, motion = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    ...(width <= 520 ? { isMobile: true, hasTouch: true } : {}),
    reducedMotion: motion ? "no-preference" : "reduce",
  });
  await context.addInitScript((language) => {
    localStorage.setItem(
      "trip.settings.v1",
      JSON.stringify({
        version: 1,
        travel: { homeCity: "", preferences: [] },
        language,
        dataMode: "mock",
        appearance: "light",
        updatedAt: "2026-11-03T00:00:00Z",
      }),
    );
  }, language);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForLoadState("networkidle");
  await startExamplePlan(page);
  await page.locator(".msg-item--agent .msg-item__clock").first().waitFor({ timeout: 180_000 });
  await settle(page, 800);
  return { context, page, errors };
}

const orangeTexts = (page) =>
  page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--warn)";
    document.querySelector(".workspace-app").append(probe);
    const warn = getComputedStyle(probe).color;
    probe.remove();
    const panel = document.querySelector(".workspace-panel--trip");
    return [...panel.querySelectorAll("*")]
      .filter(
        (node) =>
          node.checkVisibility() &&
          getComputedStyle(node).color === warn &&
          [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim()),
      )
      .map((node) => node.className);
  });

async function phoneRun(browser, { width, height, language, motion }) {
  const label = `${language}-${width}`;
  const copy = COPY[language];
  const { context, page, errors } = await open(browser, { width, height, language, motion });

  await settle(page, 1500);
  const reveal = await page.evaluate(async () => {
    const word = document.createElement("span");
    word.className = "msg-reveal__word";
    word.textContent = "probe";
    document.querySelector(".chat__stream").append(word);
    await new Promise((done) => setTimeout(done, 600));
    const probe = getComputedStyle(word).filter;
    word.remove();
    const reply = [...document.querySelectorAll(".msg-reveal__word")]
      .map((node) => getComputedStyle(node).filter)
      .filter((value) => value !== "none").length;
    return { probe, reply };
  });
  check(
    !motion || (reveal.probe === "none" && reveal.reply === 0),
    `${label}: revealed reply words keep no filter once the reveal ends`,
    reveal,
  );

  await page.locator(".phone-topbar__team").click();
  const sheet = page.locator("dialog.phone-trajectory[open]");
  await sheet.waitFor();
  await settle(page);
  const team = await sheet.evaluate((dialog) => {
    const title = dialog.querySelector("#phone-trajectory-title");
    const rows = [...dialog.querySelectorAll(".team-panel__row")].map((row) => {
      const box = row.getBoundingClientRect();
      const task = [...row.querySelectorAll("[data-tone]")].find((node) => node.checkVisibility());
      return {
        left: Math.round(box.left),
        height: Math.round(box.height),
        status: row.querySelector(".team-panel__status")?.checkVisibility() ?? false,
        task: Boolean(task) && task.scrollHeight <= 24,
      };
    });
    const tab = dialog.querySelector(".trajectory-tab");
    return {
      title: title?.textContent,
      titleLines: title
        ? Math.round(
            title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight),
          )
        : 0,
      focused: document.activeElement === title,
      rosterOpen: dialog.querySelector(".phone-trajectory__team")?.open,
      rows,
      dialogBg: getComputedStyle(dialog).backgroundColor,
      tabBg: tab ? getComputedStyle(tab).backgroundColor : null,
      assignments: [...dialog.querySelectorAll(".team-panel__assignment")].filter((node) =>
        node.checkVisibility(),
      ).length,
    };
  });
  check(team.title === copy.title, `${label}: the team sheet is titled ${copy.title}`, team.title);
  check(team.titleLines === 1, `${label}: the title fits one line`, team.titleLines);
  check(team.focused, `${label}: opening the sheet focuses its title, not the close button`);
  check(team.rosterOpen, `${label}: the specialist team is open`);
  check(
    team.rows.length === 6 && new Set(team.rows.map((row) => row.left)).size === 1,
    `${label}: six agents in one column`,
    team.rows.map((row) => row.left),
  );
  check(
    team.rows.every((row) => row.status && row.task && row.height <= 72),
    `${label}: each agent row shows its status and a one-line objective`,
    team.rows,
  );
  check(team.assignments === 0, `${label}: the assignment cards stay on desktop`, team.assignments);
  check(team.dialogBg === team.tabBg, `${label}: the ledger shares the sheet background`, team);
  await page.screenshot({ path: resolve(OUT, `${label}-team.png`) });
  const pressable = sheet.locator(".team-panel__row .team-panel__press:not(:disabled)").first();
  if (await pressable.count()) {
    await pressable.click();
    await settle(page);
    check(
      (await sheet.locator(".trajectory-tab").innerText()).length > 0 &&
        !(await sheet.locator(".phone-trajectory__team").evaluate((node) => node.open)),
      `${label}: pressing an agent still filters the ledger`,
    );
  }
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "hidden" });
  await page.locator(".phone-topbar__team").focus();
  await page.keyboard.press("Enter");
  await sheet.waitFor();
  await settle(page);
  const ring = await page.evaluate(() => {
    const title = document.querySelector("#phone-trajectory-title");
    const style = getComputedStyle(title);
    return {
      focused: document.activeElement === title,
      shadow: style.boxShadow,
      outline: style.outlineStyle === "none" ? "none" : style.outlineColor,
    };
  });
  check(
    ring.focused && ring.shadow === "none" && /none|rgba\(0, 0, 0, 0\)/.test(ring.outline),
    `${label}: the focused sheet title paints no focus ring`,
    ring,
  );
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "hidden" });

  await page.locator(".phone-tabbar").getByRole("tab", { name: copy.trip }).click();
  await settle(page, 800);
  const badge = page.locator(".workspace-panel--trip .open-items__badge");
  if (await badge.count()) {
    const row = await badge.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const text = node.querySelector(".open-items__label");
      const list = document
        .querySelector(".workspace-panel--trip .day-strip")
        ?.getBoundingClientRect();
      return {
        width: Math.round(box.width),
        listWidth: list && Math.round(list.width),
        label: text?.checkVisibility() ? text.textContent : null,
        lines: text
          ? Math.round(
              text.getBoundingClientRect().height / parseFloat(getComputedStyle(text).lineHeight),
            )
          : 0,
      };
    });
    check(
      row.label === copy.toCheck && row.lines === 1 && Math.abs(row.width - row.listWidth) <= 2,
      `${label}: open items is one line as wide as the day list`,
      row,
    );
    const orange = await orangeTexts(page);
    check(
      orange.length === 1 && orange[0].includes("open-items__count"),
      `${label}: the open-items count is the only orange text on the Trip tab`,
      orange,
    );
    await page.screenshot({ path: resolve(OUT, `${label}-trip.png`) });
    await badge.click();
    check(
      await page.locator(".open-items__popover").isVisible(),
      `${label}: the open-items line opens the list`,
    );
    await page.keyboard.press("Escape");
  } else {
    check(false, `${label}: the example plan has open items`);
  }

  const innerWidth = width;
  const weather = page.locator(".workspace-panel--trip .timeline-day__weather").first();
  if (await weather.count()) {
    await weather.scrollIntoViewIfNeeded();
    const folded = await weather.evaluate((node) => {
      const summary = node.querySelector("summary");
      return {
        tag: node.tagName,
        height: Math.round(node.getBoundingClientRect().height),
        right: Math.round(node.getBoundingClientRect().right),
        stop: Math.round(
          document
            .querySelector(".workspace-panel--trip button.timeline-stop__main")
            ?.getBoundingClientRect().right ?? 0,
        ),
        clipped: summary
          ? summary.lastElementChild.scrollWidth > summary.lastElementChild.clientWidth
          : false,
      };
    });
    check(
      folded.tag === "DETAILS" &&
        folded.height <= 64 &&
        folded.right <= innerWidth &&
        folded.stop <= innerWidth,
      `${label}: the day weather note is one line`,
      folded,
    );
    const summary = weather.locator("summary");
    if (await summary.count()) await summary.click();
    const opened = await weather.evaluate((node) => {
      const text = node.querySelector("summary > span") ?? node.querySelector("span");
      return { open: Boolean(node.open), clipped: text.scrollWidth > text.clientWidth + 1 };
    });
    check(
      opened.open && !opened.clipped,
      `${label}: tapping the weather line shows the whole note`,
      opened,
    );
  } else {
    check(false, `${label}: the example plan has a weather note`);
  }

  const stop = page.locator(".workspace-panel--trip button.timeline-stop__main").first();
  await stop.scrollIntoViewIfNeeded();
  await stop.click();
  const card = page.locator(".workspace-panel--trip .stop-place-card");
  await card.waitFor();
  await settle(page);
  const details = await card.evaluate((node) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--warn)";
    node.append(probe);
    const warn = getComputedStyle(probe).color;
    probe.remove();
    return {
      orange: [...node.querySelectorAll("p, span")]
        .filter((child) => child.checkVisibility() && getComputedStyle(child).color === warn)
        .map((child) => child.textContent.trim()),
      search: Boolean(node.querySelector('input[type="search"], input')?.checkVisibility()),
    };
  });
  check(
    details.orange.length === 0 && details.search,
    `${label}: the stop sheet has no orange paragraph and keeps its place search`,
    details,
  );
  await page.screenshot({ path: resolve(OUT, `${label}-stop.png`) });
  await page.locator(".stop-place-card__close").first().click();

  await page.locator(".phone-tabbar").getByRole("tab", { name: copy.mine }).click();
  await settle(page, 800);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll(".phone-mine .trip-card")].map((card) =>
      [".trip-card__title", ".trip-card__meta", ".trip-card__total"].map((selector) => {
        const node = card.querySelector(selector);
        return node ? node.scrollWidth <= node.clientWidth + 1 : true;
      }),
    ),
  );
  check(
    rows.length > 0 && rows.every((row) => row.every(Boolean)),
    `${label}: Mine trip rows show their title, dates and total uncut`,
    rows,
  );
  await page.locator(".trip-card").first().click();
  await page.locator(".trip-home__composer .composer").waitFor();
  await settle(page, 800);
  await page.evaluate(() => {
    const scroller = document.querySelector(".trip-home__scroll");
    scroller.scrollTop = scroller.scrollHeight;
  });
  await settle(page, 600);
  const home = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    const composer = rect(".trip-home__composer .composer");
    const map = rect(".trip-home__map");
    const buttons = [
      ...document.querySelectorAll(".trip-home__composer :is(.composer__add, .composer__primary)"),
    ].map((node) => Math.round(node.getBoundingClientRect().height));
    return {
      composerHeight: composer && Math.round(composer.height),
      mapBottom: map && Math.round(map.bottom),
      composerTop: composer && Math.round(composer.top),
      buttons,
    };
  });
  check(home.composerHeight <= 64, `${label}: the trip home composer is one row`, home);
  check(
    home.mapBottom <= home.composerTop,
    `${label}: the composer does not cover the map card`,
    home,
  );
  check(
    home.buttons.length >= 2 && home.buttons.every((size) => size >= 44),
    `${label}: add and send keep 44 px targets`,
    home.buttons,
  );
  await page.screenshot({ path: resolve(OUT, `${label}-home.png`) });

  check(errors.length === 0, `${label}: no page errors`, errors);
  await context.close();
}

async function desktopRun(browser) {
  const { context, page, errors } = await open(browser, {
    width: 1440,
    height: 900,
    language: "en",
  });
  const label = await page
    .locator(".open-items__label")
    .first()
    .evaluate((node) => node.checkVisibility())
    .catch(() => false);
  check(!label, "desktop: the open-items badge stays a count", label);
  check(errors.length === 0, "desktop: no page errors", errors);
  await context.close();
}

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  await phoneRun(browser, { width: 390, height: 844, language: "en", motion: true });
  await phoneRun(browser, { width: 360, height: 800, language: "zh" });
  await desktopRun(browser);
} finally {
  await browser.close();
  writeFileSync(resolve(OUT, "result.json"), JSON.stringify({ base: BASE, results }, null, 2));
}
const failed = results.filter((item) => !item.ok);
console.log(`${results.length - failed.length}/${results.length} ok; evidence in ${OUT}`);
if (failed.length) process.exit(1);
