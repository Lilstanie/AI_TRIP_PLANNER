import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  installSeededItinerary,
  openMockWorkspace,
  placeFor,
  planSuggestedTrip,
} from "./trip-setup.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/phone-editing", process.env.EVIDENCE_LABEL ?? "after");
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const appears = (locator, timeout = 5000) =>
  locator.waitFor({ state: "visible", timeout }).then(
    () => true,
    () => false,
  );
const waitForFocused = (locator) =>
  locator.evaluate(
    (element) =>
      new Promise((resolve, reject) => {
        const deadline = performance.now() + 5000;
        const poll = () => {
          if (document.activeElement === element) resolve(true);
          else if (performance.now() > deadline) reject(new Error("Element did not receive focus"));
          else requestAnimationFrame(poll);
        };
        poll();
      }),
  );
const waitForInsideViewport = (locator, bottom) =>
  locator.evaluate(
    (element, viewportBottom) =>
      new Promise((resolve, reject) => {
        const deadline = performance.now() + 5000;
        const poll = () => {
          const box = element.getBoundingClientRect();
          if (box.top >= 0 && box.bottom <= viewportBottom) resolve(true);
          else if (performance.now() > deadline)
            reject(new Error("Element did not fit in the contracted viewport"));
          else requestAnimationFrame(poll);
        };
        poll();
      }),
    bottom,
  );
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, { height: 844, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1 });
    window.__phoneViewport = viewport;
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const dayOne = placeFor("Day One Museum");
  const dayTwo = placeFor("Day Two Garden");
  const replacement = placeFor("Replacement Museum");
  const places = new Map([dayOne, dayTwo].map((place) => [place.id, place]));
  let placeResults = [];
  await page.route("**/api/places/search", (route) =>
    route.fulfill({ json: { places: placeResults } }),
  );
  await page.route("**/api/places/details", (route) => {
    const { placeId } = route.request().postDataJSON();
    const place = places.get(placeId) ?? { ...replacement, id: placeId };
    return route.fulfill({ json: { place } });
  });
  await installSeededItinerary(page, [
    {
      id: "phone-editing-day-1",
      kind: "activity",
      day: 1,
      startTime: "09:00",
      endTime: "10:00",
      location: dayOne.displayName.text,
      detail: dayOne.displayName.text,
      placeId: dayOne.id,
    },
    {
      id: "phone-editing-day-2",
      kind: "activity",
      day: 2,
      startTime: "11:00",
      endTime: "12:00",
      location: dayTwo.displayName.text,
      detail: dayTwo.displayName.text,
      placeId: dayTwo.id,
    },
  ]);
  await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
  await planSuggestedTrip(page);
  const stop = page.locator(".timeline-stop").first();
  const trigger = stop.locator(".action-menu__trigger");
  await trigger.click();
  await page.getByRole("menuitem", { name: "Add a note" }).click();
  const note = page.getByRole("textbox", { name: "Note", exact: true });
  await note.fill("Keep my unfinished note");
  await note.press("Escape");
  const confirmation = page.getByRole("dialog", { name: "Discard changes?", exact: true });
  const askedAtEscape = await appears(confirmation, 1000);
  check(
    !askedAtEscape && (await note.count()) === 0,
    "Escape closes a changed Stop note without asking",
  );
  check(
    !(await stop.textContent()).includes("Keep my unfinished note") &&
      (await page.getByRole("button", { name: /Continue editing/ }).count()) === 0,
    "A closed Stop note is neither applied nor kept as a draft",
  );
  await trigger.click();
  await page.getByRole("menuitem", { name: "Add a note" }).click();
  await note.press("Escape");
  check(
    !(await confirmation.isVisible()) && (await note.count()) === 0,
    "Unchanged Stop note closes directly",
  );
  const tripTimeline = page.getByRole("region", { name: "Trip timeline" });
  const dayTabs = tripTimeline.getByRole("tab");
  await dayTabs.filter({ hasText: /^Day 2/ }).click();
  await page.locator(".timeline-stop").first().waitFor({ state: "visible" });
  await page.locator(".timeline-stop").first().locator(".action-menu__trigger").click();
  await page.getByRole("menuitem", { name: "Add a note" }).click();
  await page.getByRole("textbox", { name: "Note", exact: true }).press("Escape");
  check(
    !(await confirmation.isVisible()) &&
      (await page.getByRole("textbox", { name: "Note", exact: true }).count()) === 0,
    "Unchanged Day 2 Stop note closes directly",
  );
  await dayTabs.filter({ hasText: /^Day 1/ }).click();
  await stop.waitFor({ state: "visible" });
  await trigger.click();
  await page.getByRole("menuitem", { name: "Add a note" }).click();
  await note.fill("A note for the keyboard");
  const noteSurface = note.locator("xpath=ancestor::section[@role='dialog']");
  check((await noteSurface.boundingBox()).height < 500, "A single note edit uses a bottom sheet");
  await note.press("Tab");
  await note.press("Shift+Tab");
  await note.focus();
  await page.evaluate(() => {
    window.__phoneViewport.height = 420;
    window.__phoneViewport.dispatchEvent(new Event("resize"));
  });
  const saveButton = noteSurface.getByRole("button", { name: "Save", exact: true });
  await page.waitForFunction(() => {
    const app = document.querySelector(".workspace-app");
    return (
      app?.hasAttribute("data-phone-keyboard") &&
      app.style.getPropertyValue("--phone-viewport-height") === "420px"
    );
  });
  await waitForInsideViewport(saveButton, 420);
  const saveBox = await saveButton.boundingBox();
  check(
    saveBox && saveBox.y >= 0 && saveBox.y + saveBox.height <= 420,
    "Note Save stays reachable under contracted keyboard",
    saveBox,
  );
  await page.screenshot({ path: `${out}/note-keyboard.png` });
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.__phoneViewport.height = 844;
    window.__phoneViewport.dispatchEvent(new Event("resize"));
  });
  await page.waitForFunction(() => {
    const app = document.querySelector(".workspace-app");
    return (
      !app?.hasAttribute("data-phone-keyboard") &&
      app.style.getPropertyValue("--phone-viewport-height") === "844px"
    );
  });
  await page.mouse.click(8, 100);
  check(
    !(await appears(confirmation, 1000)) && (await note.count()) === 0,
    "Outside Stop dismissal closes a changed note without asking",
  );
  await trigger.click();
  await page.getByRole("menuitem", { name: "Add a note" }).click();
  await note.fill("Back closes this");
  await page.evaluate(() => history.back());
  check(
    !(await appears(confirmation, 1000)),
    "Phone Back closes a changed Stop note without asking",
  );
  const factsSheet = page.locator("#trip-facts-sheet");
  if (await factsSheet.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await factsSheet.waitFor({ state: "hidden" });
  }
  const stopMain = stop.locator(".timeline-stop__main");
  await waitForFocused(stopMain);
  check(
    await stopMain.evaluate((el) => document.activeElement === el),
    "Closing a note returns focus to the Stop",
  );
  await trigger.click();
  await page.getByRole("menuitem", { name: "Edit details", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Edit details", exact: true });
  const detailInput = page.getByRole("textbox", { name: "What you will do", exact: true });
  await detailInput.fill("An unfinished detailed visit");
  const fullBox = await details.boundingBox();
  check(fullBox.y <= 1 && fullBox.height > 700, "Complex Stop details use a full page", fullBox);
  await detailInput.press("Escape");
  check(
    !(await appears(confirmation, 1000)) && (await detailInput.count()) === 0,
    "Escape closes changed details without asking",
  );
  for (const width of [521, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForFunction((expected) => innerWidth === expected, width);
    const desktopTrip = page.getByRole("region", { name: "Trip timeline", exact: true });
    await desktopTrip.waitFor({ state: "visible" });
    check(await desktopTrip.isVisible(), `Trip timeline remains reachable at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".phone-tabbar").waitFor({ state: "visible" });
  await stop.locator(".timeline-stop__time").click();
  const timeForm = page.locator(".stop-editor__time");
  const start = timeForm.getByLabel("Start", { exact: true });
  await start.fill("08:15");
  await page.route("**/api/trip/preview-edit", (route) =>
    route.fulfill({ status: 503, json: { error: "Preview failed. Try the change again." } }),
  );
  await timeForm.getByRole("button", { name: "Change time", exact: true }).click();
  await page.getByText("Preview failed. Try the change again.").first().waitFor();
  check(
    (await start.count()) > 0 && (await start.inputValue()) === "08:15",
    "Failed time application retains editable values",
  );
  if (await start.count()) {
    await start.press("Escape");
    check(
      !(await appears(confirmation, 1000)) && (await start.count()) === 0,
      "Changed time Escape closes without asking",
    );
  }
  placeResults = [replacement];
  await trigger.click();
  await page.getByRole("menuitem", { name: "Replace place", exact: true }).click();
  const searchSurface = page.getByRole("dialog", {
    name: "Replace with another place",
    exact: true,
  });
  const placeSearch = searchSurface.getByRole("searchbox");
  await placeSearch.fill("museum");
  await searchSurface.getByRole("button", { name: "Search", exact: true }).click();
  const usePlace = searchSurface.getByRole("button", {
    name: "Use Replacement Museum",
    exact: true,
  });
  await usePlace.waitFor({ state: "visible" });
  const placePreview = page.waitForResponse((response) =>
    response.url().includes("/api/trip/preview-edit"),
  );
  await usePlace.click();
  await placePreview;
  await searchSurface.getByRole("alert").waitFor();
  check(
    (await placeSearch.inputValue()) === "museum" && (await usePlace.isVisible()),
    "Failed place application retains the query and result",
  );
  await placeSearch.press("Escape");
  check(
    !(await appears(confirmation, 1000)) && (await placeSearch.count()) === 0,
    "Changed place search Escape closes without asking",
  );
  await page.locator(".phone-tabbar").getByRole("tab", { name: /^Chat/ }).click();
  await page.locator(".phone-topbar__title-button").click();
  await page.locator('.facts-sheet__row[data-fact="budget"]').click();
  const budgetDialog = page.getByRole("dialog", { name: "Budget", exact: true });
  const budget = budgetDialog.locator("input").first();
  await budget.fill("5100");
  await budgetDialog.getByRole("button", { name: "Close budget", exact: true }).click();
  const budgetAsked = await appears(confirmation);
  check(budgetAsked, "Brief Close asks before discarding a changed budget");
  if (budgetAsked) {
    await confirmation.getByRole("button", { name: "Continue editing", exact: true }).click();
    await confirmation.waitFor({ state: "hidden" });
    check(
      (await budget.inputValue()) === "5100",
      "Brief Continue editing retains the changed budget",
    );
    check(
      (await budgetDialog.getByRole("button", { name: "Replan trip", exact: true }).count()) === 1,
      "Existing Plan Brief action explicitly replans",
    );
    await page.locator(".phone-tabbar").getByRole("tab", { name: /^Map/ }).click();
    check(!(await budgetDialog.isVisible()), "Brief yields the screen when switching tabs");
    await page.setViewportSize({ width: 521, height: 844 });
    await page.waitForFunction(() => innerWidth === 521);
    check(
      !(await budgetDialog.isVisible()),
      "Brief stays hidden when a phone tab is widened to desktop",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => innerWidth === 390);
    await page.locator(".phone-tabbar").getByRole("tab", { name: /^Chat/ }).click();
    check((await budget.inputValue()) === "5100", "Brief tab switches retain unsubmitted values");
    await page.waitForFunction(() => document.activeElement?.id === "fact-budgetTotal");
    check(
      await budget.evaluate((node) => document.activeElement === node),
      "Returning to Chat restores focus to the changed budget",
    );
    await page.mouse.click(8, 100);
    check(await appears(confirmation), "Outside Brief dismissal asks before discarding");
    await confirmation.getByRole("button", { name: "Continue editing", exact: true }).click();
    await confirmation.waitFor({ state: "hidden" });
    check(
      await budgetDialog.isVisible(),
      "Continue editing keeps the Brief open after outside dismissal",
    );
    check(
      (await page.locator("dialog[open]").count()) === 0,
      "No unrelated dialog intercepts the next Escape",
    );
    await page.keyboard.press("Escape");
    check(
      await appears(confirmation),
      "Brief Escape asks before discarding after outside dismissal",
    );
    await page.screenshot({ path: `${out}/brief-escape.png` });
    await confirmation.getByRole("button", { name: "Discard changes", exact: true }).click();
  }
  check(errors.length === 0, "No uncaught browser errors", errors);
  await page.screenshot({ path: `${out}/phone-editing.png` });
  await page.locator(".phone-tabbar").getByRole("tab", { name: /^Mine/ }).click();
  await page.getByRole("button", { name: "Settings & account", exact: true }).click();
  await page.getByRole("tab", { name: "Language & region", exact: true }).click();
  await page.getByRole("button", { name: "Change Language", exact: true }).click();
  await page.getByRole("button", { name: "简体中文", exact: true }).click();
  await page.getByRole("button", { name: "关闭设置", exact: true }).click();
  {
    await page.locator(".phone-tabbar").getByRole("tab", { name: /^行程/ }).click();
    await trigger.click();
    await page.getByRole("menuitem", { name: "添加备注", exact: true }).click();
    const zhNote = page.getByRole("textbox", { name: "备注", exact: true });
    await zhNote.fill("这段备注只在输入框里");
    await page.screenshot({ path: `${out}/zh-note.png` });
    for (const width of [360, 375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForFunction(
        (expected) => innerWidth === expected && document.documentElement.scrollWidth <= expected,
        width,
      );
      await zhNote.waitFor({ state: "visible" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      check(!overflow, `Chinese phone edit fits ${width}px`);
      await page.screenshot({ path: `${out}/zh-${width}.png` });
    }
    await zhNote.press("Escape");
    check(
      !(await appears(page.getByRole("dialog", { name: "放弃更改？", exact: true }), 1000)) &&
        (await zhNote.count()) === 0,
      "Chinese note closes without asking",
    );
  }
  await context.close();
} catch (error) {
  check(false, "journey completed", String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(checks, null, 2));
}
if (checks.some(({ ok }) => !ok)) process.exit(1);
