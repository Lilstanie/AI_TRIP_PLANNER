import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const OUT = resolve("output/playwright/trip-fact-editors", process.env.LABEL ?? "run");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${observed ? `: ${JSON.stringify(observed)}` : ""}`);
};
const tripId = "sydney-preferences";
const dates = ["2030-11-14", "2030-11-16"];
const snapshot = {
  version: 3,
  id: "food",
  savedAt: "2026-10-29T00:00:00Z",
  draft: {
    destination: "Sydney",
    origin: "",
    start: dates[0],
    end: dates[1],
    groupSize: "2",
    budgetTotal: "4500",
    preferences: ["Quiet mornings"],
    nationality: "",
    roomAllocation: "shared",
    minRating: "0",
    freeCancellation: false,
  },
  messages: [{ role: "user", text: "Food chat marker" }],
  input: "",
  plan: {
    tripId,
    brief: {
      tripId,
      userId: "local",
      destination: "Sydney",
      dates,
      groupSize: 2,
      budgetTotal: 4500,
    },
    round: 1,
    budgetTotal: 4500,
    estTotal: 1200,
    overrunPct: -73,
    sections: [],
  },
};
const catalog = {
  version: 4,
  activeConversationId: "conversation:food",
  activeTripId: `trip:${tripId}`,
  trips: [
    {
      id: `trip:${tripId}`,
      title: "Sydney weekend",
      renamed: true,
      updatedAt: snapshot.savedAt,
      conversationIds: ["conversation:food", "conversation:old"],
      snapshot,
    },
  ],
  conversations: [
    {
      id: "conversation:food",
      title: "Food ideas",
      renamed: true,
      updatedAt: snapshot.savedAt,
      tripId: `trip:${tripId}`,
      messages: snapshot.messages,
      input: "",
      snapshot,
    },
  ],
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "chat",
    editorView: "map",
  },
};
const other = structuredClone(catalog.trips[0]);
other.id = "trip:other";
other.title = "Other Trip";
other.snapshot.plan.tripId = "other";
other.snapshot.plan.brief.tripId = "other";
other.snapshot.draft.destination = "Melbourne";
other.conversationIds = [];
catalog.trips.push(other);
catalog.activeTripId = other.id;
catalog.activeConversationId = undefined;
catalog.conversations.push({
  ...structuredClone(catalog.conversations[0]),
  id: "conversation:old",
  title: "Old chat",
  messages: [{ role: "user", text: "Old chat marker" }],
});
const settings = (language) => ({
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "mock",
  appearance: "light",
  language,
  displayCurrency: "USD",
  updatedAt: snapshot.savedAt,
});
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null"));
const action = (page, zh = false) =>
  page.locator(".trip-home__actions").getByRole("button", {
    name: zh ? /^旅行偏好/ : /^Trip preferences/,
  });
const preferenceDialog = (page, zh = false) =>
  page.getByRole("dialog", { name: zh ? "旅行偏好" : "Trip preferences", exact: true });
const preferenceInput = (page, zh = false) =>
  page.getByRole("textbox", { name: zh ? "添加偏好" : "Add a preference" });
const preference = "Late breakfast";
let browser;
let activePage;
try {
  browser = await chromium.launch({ headless: true });
  for (const language of ["en", "zh"]) {
    const zh = language === "zh";
    const context = await browser.newContext({
      viewport: { width: zh ? 390 : 1440, height: zh ? 844 : 1000 },
      reducedMotion: "reduce",
      locale: zh ? "zh-CN" : "en-AU",
      ...(zh ? { hasTouch: true, isMobile: true } : {}),
    });
    await context.addInitScript(
      ({ catalog, settings }) => {
        if (localStorage.getItem("trip-fact-editors-seeded")) return;
        localStorage.setItem("trip-fact-editors-seeded", "1");
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
      },
      { catalog, settings: settings(language) },
    );
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    activePage = page;
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === new URL(BASE).origin
        ? route.continue()
        : route.abort(),
    );
    await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
    await page.route("**/api/chat", async (route) => {
      const request = route.request().postDataJSON();
      requests.push(request);
      await route.fulfill({
        contentType: "application/x-ndjson",
        body: `${JSON.stringify({ type: "complete", response: { reply: "Updated", plan: { ...snapshot.plan, brief: request.brief } } })}\n`,
      });
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    if (zh) {
      await page.getByRole("tab", { name: "我的" }).click();
      await page.locator(".phone-mine .trip-card").first().click();
    } else {
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Trips/ })
        .click();
      await page.locator(".trip-cards .trip-card").first().click();
    }
    const chips = page.locator(".trip-home .fact-chips");
    await chips.getByRole("button").nth(3).waitFor({ timeout: 5000 });
    const names = zh
      ? [/目的地|Brisbane|Sydney/, /日期|天/, /旅行人员|出行人数|traveller/i, /预算|USD|AUD/]
      : [/^Destination/, /^Dates/, /^Travellers/, /^Budget/];
    for (const name of names) {
      await chips.getByRole("button", { name }).waitFor({ timeout: 5000 });
    }
    check(
      (await chips.getByRole("button").count()) === 4,
      `${language}: four independent fact entries`,
    );
    const current = async () =>
      (await stored(page)).trips.find((trip) => trip.id === `trip:${tripId}`).snapshot;
    const otherBefore = (await stored(page)).trips.find(
      (trip) => trip.id === "trip:other",
    ).snapshot;
    const settingsBefore = await page.evaluate(() => localStorage.getItem("trip.settings.v1"));
    const open = async (index) => {
      await chips.getByRole("button").nth(index).click();
      const dialog = page.locator(".fact-popover[role=dialog]:not([aria-hidden=true])");
      await dialog.waitFor();
      return dialog;
    };
    const dismiss = async (dialog) => {
      await dialog.getByRole("button", { name: zh ? /^关闭/ : /^Close / }).click();
      const discard = page.getByRole("dialog", {
        name: zh ? "放弃更改？" : "Discard changes?",
        exact: true,
      });
      if (await discard.count())
        await discard
          .getByRole("button", { name: zh ? "放弃更改" : "Discard changes", exact: true })
          .click();
      await dialog.waitFor({ state: "hidden" });
    };
    const save = async (dialog, field, expected) => {
      await dialog.getByRole("button", { name: zh ? "保存" : "Save", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await page.waitForFunction(
        ({ field, expected, tripId }) =>
          JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}").trips?.find(
            (trip) => trip.id === `trip:${tripId}`,
          )?.snapshot.draft[field] === expected,
        { field, expected, tripId },
        { timeout: 10000 },
      );
    };
    const isolated = async (before, keys, name) => {
      const after = await current();
      const strip = (draft) =>
        Object.fromEntries(Object.entries(draft).filter(([key]) => !keys.includes(key)));
      check(
        JSON.stringify(strip(before.draft)) === JSON.stringify(strip(after.draft)) &&
          JSON.stringify(before.plan) === JSON.stringify(after.plan) &&
          requests.length === 0,
        `${language}: ${name} saves only its own fact without replanning`,
      );
    };
    let before = await current();
    let dialog = await open(0);
    await dialog
      .getByRole("button", { name: zh ? "移除Sydney" : "Remove Sydney", exact: true })
      .click();
    await dialog.getByRole("button", { name: zh ? "保存" : "Save", exact: true }).click();
    await dialog.getByRole("alert").waitFor();
    check(
      JSON.stringify((await current()).draft) === JSON.stringify(before.draft),
      `${language}: invalid destination stays local`,
    );
    await dialog
      .getByRole("textbox", { name: zh ? "添加目的地" : "Add a destination", exact: true })
      .fill("Brisbane");
    await save(dialog, "destination", "Brisbane");
    await isolated(before, ["destination", "destinationLocation", "origin"], "destination");
    check(
      await chips
        .getByRole("button")
        .nth(0)
        .evaluate((node) => node === document.activeElement),
      `${language}: Save restores the fact trigger`,
    );
    before = await current();
    dialog = await open(1);
    await dialog.getByRole("button", { name: zh ? "清除" : "Clear", exact: true }).click();
    await dismiss(dialog);
    check(
      JSON.stringify((await current()).draft) === JSON.stringify(before.draft),
      `${language}: date cancel preserves earlier saves`,
    );
    dialog = await open(1);
    await dialog.locator('[data-day="2030-11-18"]').first().click();
    await save(dialog, "end", "2030-11-18");
    await isolated(before, ["start", "end"], "dates");
    before = await current();
    dialog = await open(2);
    await dialog.locator(".fact-steppers__row").first().getByRole("button").last().click();
    await save(dialog, "groupSize", "3");
    await isolated(before, ["groupSize", "party"], "travellers");
    before = await current();
    dialog = await open(3);
    const amount = dialog.locator('input[type="number"]');
    await amount.fill("0");
    await dialog.getByRole("button", { name: zh ? "保存" : "Save", exact: true }).click();
    await dialog.getByRole("alert").waitFor();
    check(
      JSON.stringify((await current()).draft) === JSON.stringify(before.draft),
      `${language}: zero budget rejected`,
    );
    check(
      (await dialog.locator(".currency-notice").count()) > 0,
      `${language}: converted budget explains currency`,
    );
    await amount.fill("3000");
    await dialog.getByRole("button", { name: zh ? "保存" : "Save", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}").trips?.find(
          (trip) => trip.title === "Sydney weekend",
        )?.snapshot.draft.budgetSource?.amount === 3000,
      null,
      { timeout: 10000 },
    );
    await isolated(before, ["budgetTotal", "budgetSource"], "budget");
    const saved = await current();
    check(
      saved.draft.budgetSource.currency === "USD" && Number(saved.draft.budgetTotal) !== 3000,
      `${language}: entered USD retained and planning amount is AUD`,
    );
    dialog = await open(3);
    await dialog.locator('input[type="number"]').fill("7000");
    await dismiss(dialog);
    check(
      JSON.stringify((await current()).draft) === JSON.stringify(saved.draft),
      `${language}: dirty cancel preserves all saved facts`,
    );
    check(
      await chips
        .getByRole("button")
        .nth(3)
        .evaluate((node) => node === document.activeElement),
      `${language}: Cancel restores fact trigger`,
    );
    await page
      .locator(".trip-home-chats__list")
      .getByRole("button", { name: /Old chat/ })
      .click();
    await page.getByText("Old chat marker", { exact: true }).waitFor();
    dialog = await open(0);
    check(
      (await dialog.getByText("Brisbane", { exact: true }).count()) === 1,
      `${language}: old Chat retains latest Trip destination`,
    );
    await dismiss(dialog);
    await page
      .getByRole("button", { name: zh ? "返回行程主页" : "Back to trip home", exact: true })
      .click();
    await action(page, zh).click();
    await preferenceDialog(page, zh).waitFor();
    check(
      (await preferenceDialog(page, zh)
        .locator(".stop-list, .trip-calendar, .fact-steppers, .fact-budget")
        .count()) === 0,
      `${language}: Trip preferences is separate`,
    );
    await preferenceInput(page, zh).fill(preference);
    await preferenceInput(page, zh).press("Enter");
    await preferenceDialog(page, zh)
      .getByRole("button", { name: zh ? "保存" : "Save", exact: true })
      .click();
    await preferenceDialog(page, zh).waitFor({ state: "hidden" });
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}")
          .trips?.find((trip) => trip.title === "Sydney weekend")
          ?.snapshot.draft.preferences?.includes("Late breakfast"),
      null,
      { timeout: 10000 },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".workspace-app").waitFor();
    if (zh) await page.getByRole("tab", { name: "我的" }).click();
    else
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Trips/ })
        .click();
    await page.locator(".trip-card").filter({ hasText: "Sydney weekend" }).click();
    dialog = await open(0);
    check(
      (await dialog.getByText("Brisbane", { exact: true }).count()) === 1,
      `${language}: saved facts survive reload`,
    );
    await dialog
      .getByRole("button", { name: zh ? "重新规划行程" : "Replan trip", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    check(
      requests.length === 1 &&
        requests[0].tripId === tripId &&
        requests[0].brief.destination === "Brisbane" &&
        requests[0].brief.groupSize === 3 &&
        requests[0].brief.dates[1] === "2030-11-18" &&
        requests[0].brief.budgetSource.amount === 3000 &&
        requests[0].brief.preferences.includes(preference),
      `${language}: explicit Replan submits latest facts once for this Trip`,
      requests,
    );
    check(
      JSON.stringify(
        (await stored(page)).trips.find((trip) => trip.id === "trip:other").snapshot,
      ) === JSON.stringify(otherBefore) &&
        (await page.evaluate(() => localStorage.getItem("trip.settings.v1"))) === settingsBefore,
      `${language}: other Trip and Settings untouched`,
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${language}: no document overflow`,
    );
    await page.screenshot({
      path: `${OUT}/${language}-${zh ? "390" : "1440"}.png`,
      fullPage: true,
    });
    check(errors.length === 0, `${language}: no browser errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completes", String(error));
  await activePage?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  await browser?.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify({ fixture: "local catalog and planning response", results }, null, 2),
  );
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
