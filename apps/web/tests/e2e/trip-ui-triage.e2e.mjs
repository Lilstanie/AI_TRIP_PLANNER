import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const OUT = resolve("output/playwright/trip-ui-triage", process.env.LABEL ?? "after");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name} ${observed === undefined ? "" : JSON.stringify(observed)}`,
  );
};
const rgb = (css) => css.match(/[\d.]+/g).map(Number);
const ratio = (fg, bg) => {
  const lum = (c) =>
    c
      .slice(0, 3)
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const a = lum(fg),
    b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const blend = (top, bottom) =>
  top.slice(0, 3).map((v, i) => v * (top[3] ?? 1) + bottom[i] * (1 - (top[3] ?? 1)));
const covers = [
  ...readFileSync("apps/web/components/workspace/TripCover.tsx", "utf8").matchAll(/#[0-9a-f]{6}/g),
].map(([hex]) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CATALOG_KEY = "trip-workspace-catalog-v3";
const SETTINGS_KEY = "trip.settings.v1";
const settingsFor = (language) => ({
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "mock",
  appearance: "system",
  language,
  displayCurrency: "AUD",
  updatedAt: new Date(0).toISOString(),
});
const catalogFor = (plan, id, title) => {
  const savedAt = new Date(0).toISOString();
  const conversationId = `conversation:${id}`;
  const tripId = `trip:${plan.tripId}`;
  const snapshot = {
    version: 4,
    id,
    savedAt,
    plan,
    draft: {
      destination: plan.brief.destination,
      origin: plan.brief.origin ?? "",
      start: plan.brief.dates[0],
      end: plan.brief.dates[1],
      groupSize: String(plan.brief.groupSize),
      budgetTotal: String(plan.brief.budgetTotal),
      preferences: plan.brief.preferences ?? [],
      nationality: plan.brief.nationality ?? "",
      roomAllocation: "shared",
      minRating: "0",
      freeCancellation: false,
    },
    messages: [
      { role: "user", text: "Create a mock trip plan." },
      { role: "agent", text: "Your mock trip plan is ready." },
    ],
    input: "",
  };
  return {
    version: 4,
    activeConversationId: conversationId,
    activeTripId: tripId,
    conversations: [
      {
        id: conversationId,
        title,
        updatedAt: savedAt,
        tripId,
        messages: snapshot.messages,
        input: "",
        snapshot,
      },
    ],
    trips: [{ id: tripId, title, updatedAt: savedAt, conversationIds: [conversationId], snapshot }],
    layout: {
      sidebar: { collapsed: false },
      preferences: { width: 280 },
      trip: { width: 340 },
      view: "chat",
      editorView: "map",
    },
  };
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
const openChats = async (page, width) => {
  if (width <= 520) {
    await page.locator('.phone-tabbar [role="tab"]').nth(3).click();
  } else if (width <= 1000) {
    const drawer = page.locator(".workspace-drawer--nav");
    if (!(await drawer.isVisible())) await page.locator("button[aria-haspopup='dialog']").click();
  } else {
    await page.locator(".sidebar-nav .sidebar-nav__item").first().click();
  }
};
const openTrip = async (page, width) => {
  if (width <= 520) await page.locator('.phone-tabbar [role="tab"]').nth(2).click();
  else
    await page
      .locator("button.topbar-button")
      .filter({ has: page.locator("span") })
      .count()
      .then(async () => {
        await page.getByRole("button", { name: /Open your trip|打开.*行程/ }).click();
      });
};
try {
  const response = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify({
      tripId: "triage-trip-ui",
      message:
        "Plan a 4-day trip to Sydney for 2 people from 2026-12-16 to 2026-12-19, total budget 3000.",
    }),
  });
  const frames = (await response.text()).trim().split("\n").map(JSON.parse);
  const terminal = frames.at(-1);
  if (!response.ok || terminal?.type !== "complete")
    throw new Error(`Mock public plan failed: ${JSON.stringify(terminal)}`);
  const savedPlan = terminal.response.plan;
  const title = savedPlan.brief.destination;
  const catalog = catalogFor(savedPlan, "triage-trip-ui", title);
  writeFileSync(`${OUT}/api-workspace.json`, JSON.stringify(catalog, null, 2));
  check(
    catalog.version === 4 && !!catalog.conversations[0].snapshot.plan.tripId,
    "public mock chat response is stored in a valid restorable conversation catalog",
    { version: catalog.version, title, tripId: savedPlan.tripId },
  );
  const budgetPlan = JSON.parse(JSON.stringify(savedPlan));
  budgetPlan.budgetTotal = budgetPlan.estTotal;
  budgetPlan.brief.budgetTotal = budgetPlan.estTotal;
  const pricedActivity = budgetPlan.sections
    .find((section) => section.id === "itinerary")
    ?.proposal?.items?.find((item) => item.kind === "activity");
  if (!pricedActivity) throw new Error("Mock public plan has no itinerary admission to verify.");
  delete pricedActivity.estCost;
  const unpricedAdmissions =
    budgetPlan.sections
      .find((section) => section.id === "itinerary")
      ?.proposal?.items?.filter((item) => item.kind === "activity" && item.estCost === undefined)
      .length ?? 0;
  check(
    budgetPlan.budgetTotal === budgetPlan.estTotal &&
      budgetPlan.brief.budgetTotal === budgetPlan.estTotal,
    "#435 fixture budget exactly matches its estimate",
    { budgetTotal: budgetPlan.budgetTotal, estTotal: budgetPlan.estTotal },
  );
  check(unpricedAdmissions > 0, "#435 fixture contains unpriced admissions", unpricedAdmissions);
  const headroomPlan = JSON.parse(JSON.stringify(budgetPlan));
  headroomPlan.budgetTotal = headroomPlan.estTotal + 1;
  headroomPlan.brief.budgetTotal = headroomPlan.estTotal + 1;
  const headroomTitle = `${headroomPlan.brief.destination} headroom check`;
  const headroomCatalog = catalogFor(headroomPlan, "triage-trip-ui-headroom", headroomTitle);
  const budgetTitle = `${budgetPlan.brief.destination} budget check`;
  const budgetCatalog = catalogFor(budgetPlan, "triage-trip-ui-budget", budgetTitle);
  const budgetContext = await browser.newContext({
    viewport: { width: 1024, height: 900 },
    locale: "en-AU",
    reducedMotion: "reduce",
  });
  await budgetContext.tracing.start({ screenshots: true, snapshots: true });
  const budgetPage = await budgetContext.newPage();
  await budgetPage.addInitScript(
    ({ key, value, settingsKey, settings }) => {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem(settingsKey, JSON.stringify(settings));
    },
    {
      key: CATALOG_KEY,
      value: budgetCatalog,
      settingsKey: SETTINGS_KEY,
      settings: settingsFor("en"),
    },
  );
  await budgetPage.goto(BASE);
  await budgetPage.locator(".workspace-app").waitFor();
  await openChats(budgetPage, 1024);
  await budgetPage.locator(`.history-item__open[title=${JSON.stringify(budgetTitle)}]`).waitFor();
  await budgetPage.locator(`.history-item__open[title=${JSON.stringify(budgetTitle)}]`).click();
  check(
    (await budgetPage.locator(".msg-item--agent .msg-item__body").count()) > 0,
    "#435 saved budget conversation restores its agent response",
  );
  await budgetPage.getByRole("button", { name: "Open your trip" }).click();
  await budgetPage.locator(".budget-status").waitFor();
  const budgetSummary = await budgetPage.locator(".trip-panel__budget-summary").innerText();
  const budgetNote = await budgetPage.locator(".trip__budget-note").allTextContents();
  const budgetStatus = await budgetPage.locator(".budget-status").innerText();
  check(
    budgetStatus === "At budget · unpriced stops not counted",
    "#435 exact estimate reports unpriced admissions in its status",
    budgetStatus,
  );
  check(
    (await budgetPage.locator(".budget-status--caution").count()) === 1,
    "#435 exact budget with unpriced admissions uses the caution state",
  );
  check(
    budgetNote.some((note) => /costs for stops without a published price \(\d+\)/i.test(note)),
    "#435 unpriced stop costs are disclosed",
    { budgetNote, budgetSummary },
  );
  check(!/AUD\s*0\s*under/i.test(budgetSummary), "#435 does not claim AUD 0 under budget");
  await budgetPage.locator(".trip-panel__budget-summary").scrollIntoViewIfNeeded();
  await budgetPage.screenshot({ path: `${OUT}/435-budget-acceptance.png`, fullPage: true });
  await budgetContext.tracing.stop({ path: `${OUT}/435-budget-trace.zip` });
  await budgetContext.close();
  const headroomContext = await browser.newContext({
    viewport: { width: 1024, height: 900 },
    locale: "en-AU",
    reducedMotion: "reduce",
  });
  const headroomPage = await headroomContext.newPage();
  await headroomPage.addInitScript(
    ({ key, value, settingsKey, settings }) => {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem(settingsKey, JSON.stringify(settings));
    },
    {
      key: CATALOG_KEY,
      value: headroomCatalog,
      settingsKey: SETTINGS_KEY,
      settings: settingsFor("en"),
    },
  );
  await headroomPage.goto(BASE);
  await headroomPage.locator(".workspace-app").waitFor();
  await openChats(headroomPage, 1024);
  await headroomPage
    .locator(`.history-item__open[title=${JSON.stringify(headroomTitle)}]`)
    .waitFor();
  await headroomPage.locator(`.history-item__open[title=${JSON.stringify(headroomTitle)}]`).click();
  await openTrip(headroomPage, 1024);
  await headroomPage.locator(".budget-status").waitFor();
  const headroomStatus = await headroomPage.locator(".budget-status").innerText();
  check(
    headroomStatus === "Known estimate within budget · unpriced stops not counted",
    "#435 one-dollar headroom with unpriced admissions is qualified",
    headroomStatus,
  );
  check(
    (await headroomPage.locator(".budget-status--caution").count()) === 1,
    "#435 headroom with unpriced admissions uses the caution state",
  );
  await headroomPage.screenshot({ path: `${OUT}/435-headroom-acceptance.png`, fullPage: true });
  await headroomContext.close();
  for (const scheme of ["light", "dark"])
    for (const lang of ["en", "zh"])
      for (const width of [375, 1024]) {
        const tag = `${scheme}-${lang}-${width}`;
        const ctx = await browser.newContext({
          viewport: { width, height: 900 },
          locale: lang === "zh" ? "zh-CN" : "en-AU",
          colorScheme: scheme,
          reducedMotion: "reduce",
        });
        const p = await ctx.newPage();
        const errors = [];
        p.on("pageerror", (e) => errors.push(String(e)));
        await p.goto(BASE);
        await p.locator(".workspace-app").waitFor();
        if (width === 375) {
          await openTrip(p, width);
          const styles = await p.locator(".trip-drawer-empty button").evaluateAll((nodes) =>
            nodes.map((n) => {
              const s = getComputedStyle(n);
              return {
                color: s.color,
                fill: s.backgroundColor,
                base: getComputedStyle(document.body).backgroundColor,
              };
            }),
          );
          for (const s of styles)
            check(
              ratio(rgb(s.color), blend(rgb(s.fill), rgb(s.base))) >= 4.5,
              `${tag} #412 enabled empty action contrast`,
              s,
            );
        }
        await p.addInitScript(
          ({ key, value, settingsKey, settings }) => {
            localStorage.setItem(key, JSON.stringify(value));
            localStorage.setItem(settingsKey, JSON.stringify(settings));
          },
          {
            key: CATALOG_KEY,
            value: catalog,
            settingsKey: SETTINGS_KEY,
            settings: settingsFor(lang),
          },
        );
        await p.reload();
        await p.locator(".workspace-app").waitFor();
        await openChats(p, width);
        await p.locator(`.history-item__open[title=${JSON.stringify(title)}]`).waitFor();
        await p.locator(`.history-item__open[title=${JSON.stringify(title)}]`).click();
        check(
          (await p.locator(".msg-item--agent .msg-item__body").count()) > 0,
          `${tag} saved conversation restores its agent response`,
        );
        await openTrip(p, width);
        await p.locator(".day-strip").waitFor();
        const packing = await p
          .locator(".trip-tips__packing")
          .first()
          .evaluate((n) => ({
            marker: getComputedStyle(n).listStyleType,
            size: getComputedStyle(n).fontSize,
            paragraph: getComputedStyle(n.parentElement.querySelector("p")).fontSize,
          }));
        check(
          packing.marker !== "none" && packing.size === packing.paragraph,
          `${tag} #404 marked consistent packing list`,
          packing,
        );
        const days = await p.locator(".day-strip").evaluate((n) => ({
          width: n.clientWidth,
          scroll: n.scrollWidth,
          wrap: getComputedStyle(n).flexWrap,
          scrollbar: getComputedStyle(n).scrollbarWidth,
        }));
        check(
          days.scroll <= days.width || days.scrollbar !== "none",
          `${tag} #426 days discoverable`,
          days,
        );
        await p.locator('.day-strip [aria-selected="true"]').focus();
        await p.keyboard.press("End");
        check(
          (await p.locator(".day-strip button").last().getAttribute("aria-selected")) === "true",
          `${tag} last day reachable by keyboard`,
        );
        await p.locator(".day-strip button").nth(1).click();
        for (const action of [
          lang === "zh" ? "标记为已预订" : "Mark as booked",
          lang === "zh" ? "移除" : "Remove",
        ]) {
          await p.locator(".timeline-stop .action-menu__trigger").first().click();
          const menu = p.getByRole("menuitem", { name: action, exact: true });
          if (!(await menu.count()))
            throw new Error(
              `menu unavailable ${action}: ${await p.getByRole("menuitem").allTextContents()}`,
            );
          await menu.click();
          await p.locator(".item-undo button").waitFor();
          for (const w of width === 375 ? [320, 344, 360, 375] : [1024]) {
            await p.setViewportSize({ width: w, height: 900 });
            const undo = await p.locator(".item-undo button").evaluate((n) => {
              const r = document.createRange();
              r.selectNodeContents(n);
              return {
                lines: r.getClientRects().length,
                label: n.textContent,
                width: n.clientWidth,
              };
            });
            check(undo.lines === 1, `${tag} #418/#379 ${action} Undo at ${w}`, undo);
          }
          await p.locator(".item-undo button").click();
          await p.setViewportSize({ width, height: 900 });
        }
        await p.screenshot({ path: `${OUT}/${tag}-trip.png`, fullPage: true });
        if (width <= 520) await p.locator('.phone-tabbar [role="tab"]').nth(3).click();
        else {
          await p.keyboard.press("Escape");
          await p
            .locator(".sidebar-nav button")
            .filter({ hasText: lang === "zh" ? "行程" : "Trips" })
            .click();
        }
        await p.locator(".trip-card__meta").first().waitFor();
        const caption = await p
          .locator(".trip-card__meta")
          .first()
          .evaluate((n) => ({
            color: getComputedStyle(n).color,
            fill: getComputedStyle(n.parentElement).backgroundColor,
          }));
        const ratios = covers.map((c) => ratio(rgb(caption.color), blend(rgb(caption.fill), c)));
        check(Math.min(...ratios) >= 4.5, `${tag} #407 caption over every cover stop`, {
          ...caption,
          minimum: Math.min(...ratios),
        });
        await p.screenshot({ path: `${OUT}/${tag}-cards.png`, fullPage: true });
        check(errors.length === 0, `${tag} no page errors`, errors);
        await ctx.close();
      }
} catch (e) {
  check(false, String(e));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
