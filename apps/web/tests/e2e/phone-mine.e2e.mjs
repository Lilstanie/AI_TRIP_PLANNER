// #177 failure inventory: search omits either list; opening/new stays in Mine; chat actions rely
// on hover or lose edits; calendar clips at phone width or cannot open a trip; settings/data/language
// disappear or remain in the top bar; English/Chinese targets are smaller than 44px.
// #198 crossing the phone width: the Trip drawer and the Trip tab, and Your trips and the Mine
// tab, do not become each other in both directions, so the traveller lands on another view.
// Repeatable artifact: screenshots and summary.json in output/playwright/phone-mine.
// BASE_URL=http://localhost:3000 node apps/web/tests/e2e/phone-mine.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/phone-mine");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
const draft = {
  destination: "Sydney",
  origin: "",
  start: "2030-10-01",
  end: "2030-10-04",
  groupSize: "2",
  budgetTotal: "2000",
  preferences: [],
  nationality: "",
  roomAllocation: "shared",
  minRating: "0",
  freeCancellation: false,
};
const plan = {
  tripId: "mine-trip",
  brief: {
    tripId: "mine-trip",
    userId: "local",
    destination: "Sydney",
    dates: [draft.start, draft.end],
    groupSize: 2,
    budgetTotal: 2000,
  },
  round: 1,
  budgetTotal: 2000,
  estTotal: 200,
  overrunPct: -90,
  sections: [
    {
      id: "itinerary",
      label: "Day plan",
      status: "draft",
      summary: "Sydney museum",
      estCost: 200,
      proposal: {
        agent: "itinerary",
        summary: "Sydney museum",
        items: [{ id: "mine-stop", kind: "activity", detail: "Sydney museum", estCost: 200 }],
        assumptions: [],
        conflictsWith: [],
      },
    },
  ],
};
const savedAt = "2026-10-05T00:00:00Z";
const snapshot = { version: 3, id: "mine-chat", savedAt, plan, draft, messages: [], input: "" };
const catalog = {
  version: 4,
  activeConversationId: "conversation:mine-chat",
  activeTripId: "trip:mine-trip",
  conversations: [
    {
      id: "conversation:mine-chat",
      title: "Sydney ideas",
      renamed: true,
      updatedAt: savedAt,
      tripId: "trip:mine-trip",
      messages: [],
      input: "",
      snapshot,
    },
    {
      id: "other-chat",
      title: "Kyoto notes",
      renamed: true,
      updatedAt: savedAt,
      messages: [],
      input: "",
    },
  ],
  trips: [
    {
      id: "trip:mine-trip",
      title: "Sydney",
      status: "draft",
      updatedAt: savedAt,
      conversationIds: ["conversation:mine-chat"],
      snapshot,
    },
  ],
  layout: {
    sidebar: { collapsed: false },
    preferences: { open: false, width: 280 },
    trip: { open: false, width: 340 },
    view: "mine",
    editorView: "map",
  },
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const width of [390, 360]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    await context.addInitScript((seed) => {
      if (!localStorage.getItem("trip-workspace-catalog-v3")) {
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed));
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({ language: "en", tripData: "mock" }),
        );
      }
    }, catalog);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(BASE);
    await page.waitForSelector(".phone-mine");
    await page.addStyleTag({ content: "nextjs-portal { display:none !important; }" });
    const locationPrompt = page.getByRole("button", { name: "Not now", exact: true });
    if (await locationPrompt.isVisible()) await locationPrompt.click();
    const mine = page.locator(".phone-mine");
    const selectMine = async () => {
      await page
        .getByRole("tablist", { name: "Workspace sections" })
        .getByRole("tab", { name: "Mine", exact: true })
        .click();
      await mine.waitFor();
    };
    const chatSelected = async () =>
      (await page
        .getByRole("tablist", { name: "Workspace sections" })
        .getByRole("tab", { name: "Chat", exact: true })
        .getAttribute("aria-selected")) === "true";
    const search = mine.getByRole("searchbox", { name: "Search chats and trips" });
    check(
      await mine.getByText("Sydney ideas", { exact: true }).isVisible(),
      `${width}: chats listed`,
    );
    check(await mine.locator(".trip-card").isVisible(), `${width}: trips listed`);
    await search.fill("Sydney");
    check(
      !(await mine.getByText("Kyoto notes", { exact: true }).count()),
      `${width}: search filters chats`,
    );
    check(await mine.locator(".trip-card").isVisible(), `${width}: search finds trips`);
    await search.fill("Kyoto");
    check(await mine.getByText("No matching trips.").isVisible(), `${width}: search filters trips`);
    await mine.getByRole("button", { name: "Clear search" }).click();
    const trigger = mine.getByRole("button", { name: "Actions for Kyoto notes" });
    check(
      await trigger.evaluate((node) => getComputedStyle(node).opacity === "1"),
      `${width}: touch menu always visible`,
    );
    await trigger.click();
    check(
      await mine.getByRole("menuitem", { name: "Delete" }).isVisible(),
      `${width}: Delete available`,
    );
    page.once("dialog", (dialog) => dialog.accept("Renamed notes"));
    await mine.getByRole("menuitem", { name: "Rename" }).click();
    check(
      await mine.getByText("Renamed notes", { exact: true }).isVisible(),
      `${width}: rename saved`,
    );
    await mine.getByRole("button", { name: "Actions for Renamed notes" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await mine.getByRole("menuitem", { name: "Delete" }).click();
    check(
      !(await mine.getByText("Renamed notes", { exact: true }).count()),
      `${width}: delete saved`,
    );
    await selectMine();
    await mine.getByRole("tab", { name: "Calendar", exact: true }).click();
    check(await mine.getByRole("grid").isVisible(), `${width}: calendar visible`);
    const small = await mine.locator("button, input").evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getClientRects().length)
        .map((node) => ({
          text: node.getAttribute("aria-label") ?? node.textContent,
          box: node.getBoundingClientRect(),
        }))
        .filter(({ box }) => box.width < 44 || box.height < 44)
        .map(({ text, box }) => `${text}: ${box.width}x${box.height}`),
    );
    check(!small.length, `${width}: all Mine targets at least 44px (${small.join(", ")})`);
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width}: no horizontal page overflow`,
    );
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${width}-calendar.png` });
    await mine
      .getByRole("button", { name: /^Trip to Sydney:/ })
      .first()
      .click();
    check(await chatSelected(), `${width}: calendar trip opens Chat`);
    await selectMine();
    await mine.getByRole("tab", { name: "Trips", exact: true }).click();
    await mine.locator(".trip-card").first().click();
    check(await chatSelected(), `${width}: trip card opens Chat`);
    await selectMine();
    await mine.locator('.history-item__open[title="Sydney ideas"]').click();
    check(await chatSelected(), `${width}: selecting chat opens Chat`);
    await selectMine();
    await mine
      .locator(".chats-panel__actions")
      .getByRole("button", { name: "New chat", exact: true })
      .click();
    check(await chatSelected(), `${width}: New chat opens Chat`);
    await selectMine();
    await mine
      .locator(".chats-panel__actions")
      .getByRole("button", { name: "New trip", exact: true })
      .click();
    check(await chatSelected(), `${width}: New trip opens Chat`);
    await page.keyboard.press("Escape");
    await selectMine();
    await mine.getByRole("button", { name: "Settings & account", exact: true }).click();
    check(
      await page.getByRole("dialog", { name: "Settings", exact: true }).isVisible(),
      `${width}: settings opens`,
    );
    await page.keyboard.press("Escape");
    check(await mine.locator(".data-mode").isVisible(), `${width}: data toggle reachable`);
    check(
      !(await page
        .locator(".workspace-topbar .data-mode, .workspace-topbar .language-toggle")
        .count()),
      `${width}: data/language absent from top bar`,
    );
    await mine.getByRole("button", { name: "Switch language to 简体中文" }).click();
    check(
      await mine.getByRole("button", { name: "设置与账户", exact: true }).isVisible(),
      `${width}: Chinese settings label`,
    );
    check(
      await mine
        .locator(".chats-panel__actions")
        .getByRole("button", { name: "新聊天", exact: true })
        .isVisible(),
      `${width}: Chinese actions`,
    );
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${width}-mine-zh.png` });
    check(!errors.length, `${width}: no page errors (${errors.join(", ")})`);
    await context.close();
  }
  // The phone-only selectTrip change must preserve the existing tablet Map selection.
  const tablet = await browser.newContext({
    viewport: { width: 800, height: 900 },
    hasTouch: true,
  });
  await tablet.addInitScript((seed) => {
    localStorage.setItem(
      "trip-workspace-catalog-v3",
      JSON.stringify({ ...seed, layout: { ...seed.layout, view: "map" } }),
    );
    localStorage.setItem("trip.settings.v1", JSON.stringify({ language: "en", tripData: "mock" }));
  }, catalog);
  const tabletPage = await tablet.newPage();
  await tabletPage.goto(BASE);
  await tabletPage
    .getByRole("group", { name: "Workspace view" })
    .getByRole("button", { name: "Map", exact: true })
    .click();
  await tabletPage.getByRole("button", { name: "Open navigation" }).click();
  await tabletPage.locator(".drawer .history-item--trip .history-item__open").first().click();
  check(
    (await tabletPage
      .getByRole("group", { name: "Workspace view" })
      .getByRole("button", { name: "Map", exact: true })
      .getAttribute("aria-pressed")) === "true",
    "800: selecting a trip preserves the tablet Map view",
  );
  await tabletPage.screenshot({ path: `${OUT}/800-trip-retains-map.png` });
  // #184: Your trips crossing into phone width must keep Chat, Mine and Settings reachable
  // without opening or creating a trip.
  await tabletPage.getByRole("button", { name: "Open navigation" }).click();
  await tabletPage
    .locator(".drawer")
    .getByRole("button", { name: /^Trips/ })
    .click();
  await tabletPage.getByRole("heading", { name: "Your trips", exact: true }).waitFor();
  await tabletPage.setViewportSize({ width: 390, height: 844 });
  const tabs = tabletPage.getByRole("tablist", { name: "Workspace sections" });
  const tripsMine = tabletPage.locator(".phone-mine");
  await tabletPage.addStyleTag({ content: "nextjs-portal { display:none !important; }" });
  check(
    await tabs
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false),
    "800->390: phone tab bar shown after leaving Your trips at tablet width",
  );
  const shown = (locator) =>
    locator
      .first()
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
  check(
    (await shown(tabletPage.locator('[role="tab"][aria-selected="true"]#phone-tab-mine'))) &&
      (await shown(tripsMine.locator(".trip-card"))),
    "800->390: Your trips continues as the Mine tab with trips listed",
  );
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: `${OUT}/800-to-390-trips-mine.png` });
  await tripsMine
    .getByRole("button", { name: "Settings & account", exact: true })
    .click({ timeout: 3000 });
  check(
    await shown(tabletPage.getByRole("dialog", { name: "Settings", exact: true })),
    "800->390: Settings reachable",
  );
  await tabletPage.keyboard.press("Escape");
  await tabs.getByRole("tab", { name: "Chat", exact: true }).click({ timeout: 3000 });
  check(
    (await shown(tabletPage.locator('[role="tab"][aria-selected="true"]#phone-tab-chat'))) &&
      (await shown(tabletPage.locator(".workspace-panel--chat"))),
    "800->390: Chat reachable",
  );
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: `${OUT}/800-to-390-chat.png` });
  // #198: Trip tab -> Trip drawer -> Trip tab, and Mine -> Your trips, across the phone width.
  await tabs.getByRole("tab", { name: /^Trip/ }).click({ timeout: 3000 });
  await tabletPage.setViewportSize({ width: 800, height: 900 });
  check(
    await shown(tabletPage.getByRole("dialog", { name: "Your trip", exact: true })),
    "390->800: the Trip tab continues as the open Trip drawer",
  );
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: `${OUT}/390-to-800-trip-drawer.png` });
  await tabletPage.setViewportSize({ width: 390, height: 844 });
  check(
    (await shown(tabletPage.locator('[role="tab"][aria-selected="true"]#phone-tab-trip'))) &&
      (await shown(tabletPage.locator(".workspace-panel--trip"))),
    "800->390: the open Trip drawer continues as the Trip tab",
  );
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: `${OUT}/800-to-390-trip-tab.png` });
  await tabs.getByRole("tab", { name: "Mine", exact: true }).click({ timeout: 3000 });
  await tabletPage.setViewportSize({ width: 800, height: 900 });
  check(
    await shown(tabletPage.getByRole("heading", { name: "Your trips", exact: true })),
    "390->800: the Mine tab continues as Your trips",
  );
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: `${OUT}/390-to-800-your-trips.png` });
  await tablet.close();
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify({ base: BASE, results }, null, 2));
}
if (results.some((result) => !result.ok)) process.exitCode = 1;
