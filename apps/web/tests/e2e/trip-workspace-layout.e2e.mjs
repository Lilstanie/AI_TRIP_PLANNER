import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip } from "./trip-setup.mjs";

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
  await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
  await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3112");
  await planSuggestedTrip(page);
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
    await page.getByRole("region", { name: "Trip map" }).isVisible(),
    "wide Trip keeps the linked map visible",
  );
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
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: false });

  await page.setViewportSize({ width: 1000, height: 800 });
  await page.getByRole("button", { name: "Itinerary", exact: true }).waitFor({ state: "visible" });
  check(
    await page.getByRole("button", { name: "Map", exact: true }).isVisible(),
    "tablet retains a reachable map view",
  );
  await page.getByRole("button", { name: "Map", exact: true }).click();
  check(
    await page.locator(".trip-workspace__map").isVisible(),
    "tablet switches to the map without leaving Trip",
  );
  await page.getByRole("button", { name: "Itinerary", exact: true }).click();
  check(
    (await page.getByRole("tab", { name: /Day 2/ }).getAttribute("aria-selected")) === "true",
    "tablet view switch retains the selected day",
  );
  await page.screenshot({ path: `${out}/tablet.png`, fullPage: false });

  await page.setViewportSize({ width: 1001, height: 800 });
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
  const mediumHeader = await mediumTeam.evaluate((button) => ({
    labelVisible: getComputedStyle(button.querySelector(".team-trigger__label")).display !== "none",
    avatarCount: [...button.querySelectorAll(".team-trigger__avatars > *")].filter(
      (node) => getComputedStyle(node).display !== "none",
    ).length,
    title: document.querySelector(".topbar-title")?.getBoundingClientRect().toJSON() ?? null,
    titleReadable: (() => {
      const title = document.querySelector(".topbar-title");
      return Boolean(
        title &&
        title.getBoundingClientRect().width >= 120 &&
        title.scrollWidth <= title.clientWidth,
      );
    })(),
  }));
  check(
    !mediumHeader.labelVisible && mediumHeader.avatarCount === 1 && mediumHeader.titleReadable,
    "960px header keeps Trip identity readable with one Team icon",
    mediumHeader,
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
    (await page.getByRole("button", { name: "Itinerary", exact: true }).isVisible()) &&
      (await page.getByRole("button", { name: "Map", exact: true }).isVisible()),
    "521px remains on the tablet Trip switch",
  );

  await page.setViewportSize({ width: 520, height: 844 });
  await page.getByRole("tab", { name: "Trip", exact: true }).waitFor({ state: "visible" });
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await page.getByRole("tab", { name: "Trip", exact: true }).click();
  check(
    (await page.locator(".trip-workspace").count()) === 0,
    "phone retains its existing Trip navigation and surface",
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
