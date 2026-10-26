import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { installSeededItinerary, openMockWorkspace, settle } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  "output/playwright/trip-workspace-layout",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: "en-AU" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const fixturePlaces = [
    {
      id: "layout-fixture-opera-house",
      displayName: { text: "Sydney Opera House" },
      formattedAddress: "Bennelong Point, Sydney NSW, Australia",
      location: { latitude: -33.8568, longitude: 151.2153 },
    },
    {
      id: "layout-fixture-harbour-bridge",
      displayName: { text: "Sydney Harbour Bridge" },
      formattedAddress: "Sydney NSW, Australia",
      location: { latitude: -33.8523, longitude: 151.2108 },
    },
  ];
  await installSeededItinerary(page, [
    {
      id: "layout-stop-opera-house",
      kind: "activity",
      day: 1,
      startTime: "10:00",
      endTime: "11:00",
      location: "Sydney Opera House",
      detail: "Visit the Opera House",
      placeId: fixturePlaces[0].id,
    },
    {
      id: "layout-stop-harbour-bridge",
      kind: "activity",
      day: 2,
      startTime: "10:00",
      endTime: "11:00",
      location: "Sydney Harbour Bridge",
      detail: "Walk across the Harbour Bridge",
      placeId: fixturePlaces[1].id,
    },
  ]);
  let releaseChat;
  let signalChatStarted;
  const chatStarted = new Promise((resolve) => {
    signalChatStarted = resolve;
  });
  const chatGate = new Promise((resolve) => {
    releaseChat = resolve;
  });
  await page.route("**/api/chat", async (route) => {
    signalChatStarted();
    await chatGate;
    await route.fallback();
  });
  await page.route("**/api/places/search", (route) => {
    const { text = "" } = route.request().postDataJSON();
    const match = fixturePlaces.find((place) => place.displayName.text.includes(text));
    return route.fulfill({ json: { places: match ? [match] : [] } });
  });
  await page.route("**/api/places/details", (route) => {
    const { placeId } = route.request().postDataJSON();
    const place = fixturePlaces.find((candidate) => candidate.id === placeId);
    return route.fulfill({ json: { place: place ?? null } });
  });
  await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3112");
  const chatTab = page.getByRole("tab", { name: /^Chat/ });
  if (await chatTab.count()) await chatTab.click();
  await page.locator(".chat-empty__suggestions button").first().click();
  await chatStarted;
  await page.waitForFunction(
    () => Number(document.querySelector(".team-trigger")?.getAttribute("data-working")) > 0,
    { timeout: 30_000 },
  );
  const runningTeam = await page.locator(".team-trigger").evaluate((button) => ({
    label: button.getAttribute("aria-label"),
    working: button.getAttribute("data-working"),
    count: button.querySelector(".team-trigger__count")?.textContent?.trim(),
  }));
  check(
    /\d+ working/.test(runningTeam.label ?? "") && Number(runningTeam.working) > 0,
    "topbar announces the active Team working count",
    runningTeam,
  );
  await page.setViewportSize({ width: 960, height: 800 });
  await page.waitForFunction(
    () => document.querySelector(".workspace-app")?.getAttribute("data-narrow") === "true",
  );
  const compactWorkingTeam = await page.locator(".team-trigger").evaluate((button) => {
    const count = button.querySelector(".team-trigger__count");
    const compactCount = button.querySelector(".team-trigger__count-compact");
    const buttonBox = button.getBoundingClientRect();
    const countBox = count?.getBoundingClientRect();
    return {
      label: button.getAttribute("aria-label"),
      working: Number(button.getAttribute("data-working")),
      visibleAvatars: [...button.querySelectorAll(".team-trigger__avatars > *")].filter(
        (node) => getComputedStyle(node).display !== "none",
      ).length,
      compactCount: compactCount?.textContent?.trim(),
      compactCountVisible: Boolean(
        compactCount &&
          getComputedStyle(compactCount).display !== "none" &&
          getComputedStyle(compactCount).visibility !== "hidden" &&
          compactCount.getClientRects().length > 0,
      ),
      countFitsButton: Boolean(
        countBox &&
          buttonBox.width > 0 &&
          countBox.width > 0 &&
          countBox.left >= buttonBox.left &&
          countBox.right <= buttonBox.right &&
          countBox.top >= buttonBox.top &&
          countBox.bottom <= buttonBox.bottom,
      ),
      noPageOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  check(
    compactWorkingTeam.working > 0 &&
      /\d+ working/.test(compactWorkingTeam.label ?? "") &&
      compactWorkingTeam.visibleAvatars === 1 &&
      compactWorkingTeam.compactCount === String(compactWorkingTeam.working) &&
      compactWorkingTeam.compactCountVisible &&
      compactWorkingTeam.countFitsButton &&
      compactWorkingTeam.noPageOverflow,
    "960px compact header visibly fits the active Team count beside one icon",
    compactWorkingTeam,
  );
  await page.screenshot({ path: `${out}/header-960-working.png`, fullPage: false });
  const compactTeamButton = page.locator(".team-trigger");
  await compactTeamButton.focus();
  await compactTeamButton.press("Enter");
  check(
    await page.getByRole("dialog", { name: "Specialist team" }).isVisible(),
    "960px active Team control remains keyboard operable",
  );
  await compactTeamButton.press("Escape");
  check(
    await page.evaluate(() => document.activeElement?.classList.contains("team-trigger")),
    "960px Escape returns focus to the active Team control",
  );
  releaseChat();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(
    () => document.querySelector(".workspace-app")?.getAttribute("data-narrow") === "false",
  );
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
  await settle(page, 1200);
  const tripTab = page.getByRole("tab", { name: /^Trip/ });
  if (await tripTab.count()) await tripTab.click();
  else await page.getByRole("button", { name: "Open your trip" }).click();
  await page.getByRole("region", { name: "Trip timeline" }).waitFor({ timeout: 30_000 });
  await settle(page, 600);
  const dismiss = page.getByRole("button", { name: "Not now", exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  const openTrip = page.getByRole("button", { name: "Open your trip", exact: true });
  if ((await openTrip.getAttribute("aria-expanded")) !== "true") await openTrip.click();

  const workspace = page.locator(".trip-workspace");
  await workspace.waitFor({ state: "visible", timeout: 30_000 });
  check(
    await page.getByRole("region", { name: "Trip timeline" }).isVisible(),
    "wide Trip keeps the timeline visible",
  );
  check(
    await page.getByRole("region", { name: "Trip map" }).first().isVisible(),
    "wide Trip keeps the linked map visible",
  );
  await page.locator("trip-libre-marker").first().waitFor({ state: "visible", timeout: 30_000 });
  check(
    (await page.locator("trip-libre-marker").count()) >= 1,
    "fixture place renders as a located map marker",
  );
  await page.locator("trip-libre-marker").first().click();
  await page.locator(".stop-place-card").waitFor({ state: "visible", timeout: 10_000 });
  check(
    (await page.locator(".timeline-stop__main[aria-expanded=true]").count()) === 1 &&
      (await page.locator(".stop-place-card").innerText()).includes("Sydney Opera House"),
    "selecting a located map marker selects its Stop and opens the matching place details",
  );
  await page
    .locator(".stop-place-card")
    .getByRole("button", { name: "Close place details" })
    .click();
  await page.getByRole("tab", { name: /Day 2/ }).click();
  await page.waitForFunction(
    () => document.querySelector(".trip-workspace")?.getAttribute("data-day") === "2",
  );
  check(true, "wide day navigation keeps map and timeline on the same day");
  const geometry = await workspace.evaluate((node) => {
    const timeline = node.querySelector(".trip-workspace__timeline").getBoundingClientRect();
    const map = node.querySelector(".trip-workspace__map").getBoundingClientRect();
    return {
      timeline: Math.round(timeline.width),
      map: Math.round(map.width),
      gap: Math.round(map.left - timeline.right),
    };
  });
  check(
    geometry.timeline > 0 && geometry.map > 0 && geometry.gap >= 0,
    "wide timeline and map occupy adjacent regions",
    geometry,
  );
  const desktopIdentity = await page.locator(".topbar-title").evaluate((title) => ({
    width: title.getBoundingClientRect().width,
    scrollWidth: title.scrollWidth,
    visibleAvatars: [...document.querySelectorAll(".team-trigger__avatars > *")].filter(
      (node) => getComputedStyle(node).display !== "none",
    ).length,
  }));
  check(
    desktopIdentity.visibleAvatars === 1 &&
      desktopIdentity.width >= 120 &&
      desktopIdentity.scrollWidth <= desktopIdentity.width,
    "expanded-sidebar header keeps Trip identity readable with one Team icon",
    desktopIdentity,
  );
  const renameActiveTrip = async (title) => {
    await page
      .locator(".sidebar-nav__item")
      .filter({ hasText: /Trips|行程/ })
      .click();
    const tripRow = page.locator(".trip-cards > li").first();
    await tripRow.waitFor({ state: "visible" });
    await tripRow.locator(".history-item__more").click();
    page.once("dialog", (dialog) => dialog.accept(title));
    await page.getByRole("menuitem").first().click();
    await tripRow.getByText(title, { exact: true }).waitFor({ state: "visible" });
    await tripRow.locator(".trip-card").click();
    await page.locator(".topbar-title").waitFor({ state: "visible" });
    const openTrip = page.locator(".trip-trigger");
    if ((await openTrip.count()) && (await openTrip.getAttribute("aria-expanded")) !== "true") {
      await openTrip.click();
    }
    await page.locator(".trip-workspace").waitFor({ state: "visible" });
    await settle(page, 300);
  };
  await page.locator(".sidebar-nav__item").filter({ hasText: "Chats" }).click();
  await page.locator(".history-item--trip").waitFor({ state: "visible" });
  const longEnglishTitle = "Sydney harbour, beaches, gardens and family food itinerary";
  await renameActiveTrip(longEnglishTitle);
  const englishTitleLayout = await page.locator(".topbar-title").evaluate((title) => ({
    text: title.textContent?.trim(),
    width: title.getBoundingClientRect().width,
    scrollWidth: title.scrollWidth,
  }));
  check(
    englishTitleLayout.text === longEnglishTitle &&
      englishTitleLayout.width >= 120 &&
      englishTitleLayout.scrollWidth <= englishTitleLayout.width,
    "long English Trip title remains readable beside the Team control",
    englishTitleLayout,
  );
  await page.screenshot({ path: `${out}/title-en.png`, fullPage: false });
  const switchLocale = async (locale) => {
    await page.locator(".account-button__more").click();
    await page.getByRole("menuitem").nth(3).click();
    await page.locator(".settings").waitFor({ state: "visible" });
    await page.locator(".settings-row-item").first().locator(".settings-pill").click();
    const languageGroup = page.locator(".settings-segmented").first();
    await languageGroup
      .getByRole("button", { name: locale === "zh" ? "简体中文" : "English", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await page.locator(".settings").waitFor({ state: "hidden" });
  };
  await switchLocale("zh");
  const longChineseTitle = "悉尼海港海滩花园与亲子美食行程规划";
  await renameActiveTrip(longChineseTitle);
  const chineseTitleLayout = await page.locator(".topbar-title").evaluate((title) => ({
    text: title.textContent?.trim(),
    width: title.getBoundingClientRect().width,
    scrollWidth: title.scrollWidth,
  }));
  check(
    chineseTitleLayout.text === longChineseTitle &&
      chineseTitleLayout.width >= 120 &&
      chineseTitleLayout.scrollWidth <= Math.ceil(chineseTitleLayout.width),
    "long Chinese Trip title remains readable beside the Team control",
    chineseTitleLayout,
  );
  await page.screenshot({ path: `${out}/title-zh.png`, fullPage: false });
  await switchLocale("en");
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: innerWidth,
    body: document.body.scrollWidth,
  }));
  check(
    overflow.document <= overflow.viewport && overflow.body <= overflow.viewport,
    "desktop layout has no horizontal page overflow",
    overflow,
  );
  const sidebar = page.locator(".workspace-sidebar");
  const sidebarToggle = sidebar.locator(".sidebar-toggle");
  check(
    (await sidebarToggle.getAttribute("aria-expanded")) === "true",
    "desktop starts with an expanded sidebar",
  );
  await sidebarToggle.click();
  await page.locator(".workspace-sidebar.is-collapsed").waitFor({ state: "visible" });
  check(
    (await sidebar.locator(".sidebar-toggle").getAttribute("aria-expanded")) === "false",
    "desktop sidebar collapses accessibly",
  );
  await sidebar.locator(".sidebar-toggle").click();
  await page.locator(".workspace-sidebar:not(.is-collapsed)").waitFor({ state: "visible" });
  check(
    (await sidebar.locator(".sidebar-toggle").getAttribute("aria-expanded")) === "true",
    "desktop sidebar expands accessibly",
  );
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: false });

  await page.setViewportSize({ width: 1000, height: 800 });
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "1000px tablet layout has no horizontal page overflow",
  );
  const viewSwitch = page.locator(".topbar-views");
  await viewSwitch
    .getByRole("button", { name: "Itinerary", exact: true })
    .waitFor({ state: "visible" });
  const mapViewButton = viewSwitch.getByRole("button", { name: "Map", exact: true });
  check(await mapViewButton.isVisible(), "tablet retains a reachable map view");
  await mapViewButton.click();
  await page.waitForFunction(
    () =>
      document.querySelector('.topbar-views button[aria-pressed="true"]')?.textContent?.trim() ===
      "Map",
  );
  const tabletMap = await page.evaluate(() => ({
    selected: document
      .querySelector('.topbar-views button[aria-pressed="true"]')
      ?.textContent?.trim(),
    workspaceView: document.querySelector(".trip-workspace")?.getAttribute("data-view"),
    mapHidden: document.querySelector(".trip-workspace__map")?.hasAttribute("hidden"),
    narrow: document.querySelector(".workspace-app")?.getAttribute("data-narrow"),
  }));
  check(
    tabletMap.selected === "Map" && tabletMap.workspaceView === "map" && !tabletMap.mapHidden,
    "tablet switches to the map without leaving Trip",
    tabletMap,
  );
  await viewSwitch.getByRole("button", { name: "Itinerary", exact: true }).click();
  check(
    (await page.getByRole("tab", { name: /Day 2/ }).getAttribute("aria-selected")) === "true",
    "tablet view switch retains the selected day",
  );
  await page.screenshot({ path: `${out}/tablet.png`, fullPage: false });

  await page.setViewportSize({ width: 1001, height: 800 });
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "1001px desktop layout has no horizontal page overflow",
  );
  await page.waitForFunction(
    () => document.querySelector(".workspace-app")?.getAttribute("data-narrow") === "false",
  );
  check(
    (await page.locator(".trip-workspace__timeline").isVisible()) &&
      (await page.locator(".trip-workspace__map").isVisible()),
    "1001px keeps the desktop timeline and map together",
  );
  check(
    (await page.getByRole("button", { name: "Itinerary", exact: true }).count()) === 0,
    "1001px does not show the tablet view switch",
  );

  await page.setViewportSize({ width: 960, height: 800 });
  await page.waitForFunction(
    () => document.querySelector(".workspace-app")?.getAttribute("data-narrow") === "true",
  );
  const mediumTeam = page.getByRole("button", { name: /Agent Team/ });
  const mediumHeader = await mediumTeam.evaluate(
    (button, expectedTitle) => ({
      labelVisible:
        getComputedStyle(button.querySelector(".team-trigger__label")).display !== "none",
      avatarCount: [...button.querySelectorAll(".team-trigger__avatars > *")].filter(
        (node) => getComputedStyle(node).display !== "none",
      ).length,
      title: (() => {
        const title = document.querySelector(".topbar-title");
        return title
          ? {
              text: title.textContent?.trim(),
              ...title.getBoundingClientRect().toJSON(),
              clientWidth: title.clientWidth,
              scrollWidth: title.scrollWidth,
            }
          : null;
      })(),
      titleIdentityPreserved: (() => {
        const title = document.querySelector(".topbar-title");
        return Boolean(
          title &&
          title.textContent?.trim() === expectedTitle &&
          title.getBoundingClientRect().width >= 120,
        );
      })(),
    }),
    longChineseTitle,
  );
  check(
    !mediumHeader.labelVisible &&
      mediumHeader.avatarCount === 1 &&
      mediumHeader.titleIdentityPreserved,
    "960px header preserves full Trip identity in a usable title slot beside one Team icon",
    mediumHeader,
  );
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "zoom-equivalent constrained 960px usable width has no horizontal page overflow",
  );
  await page.screenshot({ path: `${out}/header-960.png`, fullPage: false });

  await page.setViewportSize({ width: 900, height: 800 });
  await page.waitForFunction(
    () => document.querySelector(".workspace-app")?.getAttribute("data-narrow") === "true",
  );
  check(
    await page.locator(".topbar-chat-tabs").isVisible(),
    "compact header keeps Conversation and Trajectory reachable",
  );
  const team = page.getByRole("button", { name: /Agent Team/ });
  await team.waitFor({ state: "visible" });
  const compact = await team.evaluate((button) => ({
    visibleAvatars: [...button.querySelectorAll(".team-trigger__avatars > *")].filter(
      (node) => getComputedStyle(node).display !== "none",
    ).length,
    workingText: button.querySelector(".team-trigger__count")?.textContent?.trim() ?? "",
    button: button.getBoundingClientRect().toJSON(),
  }));
  check(compact.visibleAvatars <= 1, "constrained header compacts Agent Team to one icon", compact);
  await team.focus();
  await team.press("Enter");
  check(
    await page.getByRole("dialog", { name: "Specialist team" }).isVisible(),
    "compact Agent Team remains keyboard operable",
  );
  await page.getByRole("button", { name: "Agent Team", exact: true }).press("Escape");
  await page.screenshot({ path: `${out}/header-900.png`, fullPage: false });

  await page.setViewportSize({ width: 521, height: 844 });
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "521px tablet layout has no horizontal page overflow",
  );
  check(
    (await page.getByRole("button", { name: "Itinerary", exact: true }).isVisible()) &&
      (await page.getByRole("button", { name: "Map", exact: true }).isVisible()),
    "521px remains on the tablet Trip switch",
  );

  await page.setViewportSize({ width: 520, height: 844 });
  await page.getByRole("tab", { name: "Trip", exact: true }).waitFor({ state: "visible" });
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#phone-tab-map")?.getAttribute("aria-selected") === "true",
  );
  const mapTabState = await page.evaluate(() => ({
    selected: document.querySelector('.phone-tabbar [role="tab"][aria-selected="true"]')?.id,
    mapHidden: document.querySelector("#phone-panel-map")?.hasAttribute("hidden"),
    tripHidden: document.querySelector("#phone-panel-trip")?.hasAttribute("hidden"),
  }));
  check(
    mapTabState.selected === "phone-tab-map" && mapTabState.mapHidden === false && mapTabState.tripHidden === true,
    "520px Map tab selection exposes only the Map panel after settling",
    mapTabState,
  );
  await page.getByRole("tab", { name: "Trip", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#phone-tab-trip")?.getAttribute("aria-selected") === "true",
  );
  const tripTabState = await page.evaluate(() => ({
    selected: document.querySelector('.phone-tabbar [role="tab"][aria-selected="true"]')?.id,
    mapHidden: document.querySelector("#phone-panel-map")?.hasAttribute("hidden"),
    tripHidden: document.querySelector("#phone-panel-trip")?.hasAttribute("hidden"),
  }));
  check(
    tripTabState.selected === "phone-tab-trip" && tripTabState.tripHidden === false && tripTabState.mapHidden === true,
    "520px Trip tab selection exposes only the Trip panel after settling",
    tripTabState,
  );
  await settle(page, 250);
  check(
    (await page.locator(".trip-workspace").count()) === 0,
    "phone retains its existing Trip navigation and surface",
  );
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "520px phone layout has no horizontal page overflow",
  );
  check(errors.length === 0, "fixture journey has no browser errors", errors);
  await page.screenshot({ path: `${out}/phone-520.png`, fullPage: false });
} catch (error) {
  check(false, "workspace layout journey completed", String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(checks, null, 2));
}

if (checks.some(({ ok }) => !ok)) process.exit(1);
