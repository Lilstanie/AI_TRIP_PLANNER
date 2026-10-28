import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const OUT = resolve("output/playwright/trip-home-preferences", process.env.LABEL ?? "run");
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
      conversationIds: ["conversation:food"],
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
const settings = (language) => ({
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "mock",
  appearance: "light",
  language,
  displayCurrency: "AUD",
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
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
      },
      { catalog, settings: settings(language) },
    );
    const page = await context.newPage();
    activePage = page;
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
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
    await page
      .locator(".trip-home-chats__list")
      .getByRole("button", { name: /Food ideas/ })
      .click();
    await page.getByText("Food chat marker", { exact: true }).waitFor();
    await action(page, zh).click();
    const dialog = preferenceDialog(page, zh);
    await dialog.waitFor();
    const save = dialog.getByRole("button", { name: zh ? "保存" : "Save", exact: true });
    const replan = dialog.getByRole("button", {
      name: zh ? "重新规划行程" : "Replan trip",
      exact: true,
    });
    check(
      (await save.count()) === 1 && (await replan.count()) === 1,
      `${language}: Save and Replan are available`,
    );
    if (!(await save.count())) {
      await page.screenshot({ path: `${OUT}/red-${language}.png` });
      await context.close();
      continue;
    }
    await preferenceInput(page, zh).fill(preference);
    await preferenceInput(page, zh).press("Enter");
    check(
      !(await stored(page)).trips[0].snapshot.draft.preferences.includes(preference),
      `${language}: editing does not save before Save`,
    );
    await save.click();
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(
      (text) =>
        JSON.parse(
          localStorage.getItem("trip-workspace-catalog-v3") ?? "{}",
        ).trips?.[0]?.snapshot?.draft?.preferences?.includes(text),
      preference,
    );
    check(
      (await action(page, zh).evaluate((node) => node === document.activeElement)) &&
        (await page.getByText("Food chat marker", { exact: true }).count()) === 1,
      `${language}: Save closes the drawer and preserves Chat and focus`,
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".workspace-app").waitFor();
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
    await action(page, zh).click();
    await preferenceDialog(page, zh).waitFor();
    check(
      (await preferenceDialog(page, zh).getByText(preference, { exact: true }).count()) === 1,
      `${language}: Save survives reload in the same Trip`,
    );
    await preferenceDialog(page, zh)
      .getByRole("button", {
        name: zh ? "重新规划行程" : "Replan trip",
        exact: true,
      })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector(".trip-home-action-surface")?.getAttribute("aria-hidden") === "true",
    );
    check(
      requests.length === 1 &&
        requests[0].tripId === tripId &&
        requests[0].brief.tripId === tripId &&
        requests[0].brief.preferences.includes(preference),
      `${language}: Replan submits this Trip and its saved preferences`,
      requests,
    );
    check(
      (await page.locator(".trip-home").count()) === 1 &&
        (await page.locator(".trip-home__actions").count()) === 1 &&
        (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)),
      `${language}: planning stays in Trip home without overflow`,
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
