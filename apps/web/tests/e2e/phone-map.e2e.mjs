// Failure inventory for #179, written before implementation:
// - phone map retains a fixed short height or scrolls the whole page;
// - no-plan / no-map-key states hide the stops sheet;
// - sheet cannot reach handle, half and full with pointer drag, click and keyboard;
// - selected day retains another day's stops or map route; selecting a stop loses selection;
// - phone marker details use a desktop popup or cover map controls;
// - touch controls are smaller than 44 px; strings are missing in Chinese;
// - reduced motion still animates the sheet; desktop popup changes;
// - an idea (no day) is listed or numbered as a Day 1 stop (#186).
// Run against a production server. Screenshots + summary: output/playwright/phone-map.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const OUT = resolve("output/playwright/phone-map");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, message) => {
  results.push({ ok: !!ok, message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const [width, height] of [
    [390, 844],
    [360, 800],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    // Controlled place responses exercise marker/fallback details without a provider key.
    await page.route("**/api/places/search", async (route) => {
      const { text } = route.request().postDataJSON();
      const hash = [...text].reduce((n, c) => n + c.charCodeAt(0), 0);
      await route.fulfill({
        json: {
          places: [
            {
              id: `fixture-${hash}`,
              displayName: { text },
              formattedAddress: text,
              location: { latitude: 35.6 + hash / 100000, longitude: 139.7 },
            },
          ],
        },
      });
    });
    await page.route("**/api/places/details", async (route) => {
      const { placeId } = route.request().postDataJSON();
      await route.fulfill({
        json: {
          place: {
            id: placeId,
            displayName: { text: placeId },
            location: { latitude: 35.65, longitude: 139.7 },
          },
        },
      });
    });
    // Keep the real planning flow, then give its itinerary deterministic located stops.
    await page.route("**/api/chat", async (route) => {
      const response = await route.fetch();
      const body = (await response.text())
        .split("\n")
        .map((line) => {
          if (!line.trim()) return line;
          const frame = JSON.parse(line);
          const plan = frame.response?.plan;
          if (plan)
            for (const section of plan.sections) {
              if (section.proposal?.agent !== "itinerary") continue;
              for (const [index, item] of section.proposal.items.entries()) {
                item.placeId = `phone-map-place-${item.day ?? 1}-${index}`;
                item.location = `Museum ${index + 1}`;
              }
              // The last stop becomes an idea (no day), as Move to ideas leaves it (#186).
              const idea = section.proposal.items.at(-1);
              if (idea) {
                for (const key of ["day", "startTime", "endTime", "arriveBy"]) delete idea[key];
                idea.location = "Idea Gallery";
              }
            }
          return JSON.stringify(frame);
        })
        .join("\n");
      await route.fulfill({ response, body });
    });
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
    await page.locator(".phone-tabbar").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const tab = (name) =>
      page.locator(".phone-tabbar").getByRole("tab", { name: new RegExp(`^${name}`) });
    await tab("Map").click();
    const sheet = page.locator(".phone-map-sheet");
    check(await sheet.isVisible(), `${width}: sheet before plan`);
    check(
      await sheet.innerText().then((text) => text.includes("Plan a trip")),
      `${width}: empty guidance`,
    );
    const handle = sheet.getByRole("button", { name: "Resize day stops" });
    await handle.press("Home");
    check((await sheet.getAttribute("data-snap")) === "handle", `${width}: Home collapses`);
    await handle.press("ArrowUp");
    check((await sheet.getAttribute("data-snap")) === "half", `${width}: ArrowUp half`);
    await handle.press("End");
    check((await sheet.getAttribute("data-snap")) === "full", `${width}: End expands`);
    await handle.click();
    check((await sheet.getAttribute("data-snap")) === "handle", `${width}: click cycles`);
    // Real pointer sequence through the handle's pointer capture.
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + 30, box.y + 24);
    await page.mouse.down();
    await page.mouse.move(box.x + 30, box.y - 100, { steps: 8 });
    await page.mouse.up();
    check((await sheet.getAttribute("data-snap")) === "half", `${width}: drag expands`);
    check(
      await sheet.evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration) <= 0.01),
      `${width}: reduced motion`,
    );
    await tab("Mine").click();
    const live = page.getByRole("button", { name: /^Live data/ });
    if (await live.count()) await live.first().click();
    await tab("Chat").click();
    await page.locator(".chat-empty__suggestions button").first().click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180000 });
    await tab("Map").click();
    await sheet.locator(".phone-map-sheet__stops button").first().waitFor();
    const days = sheet.locator(".phone-map-sheet__days button");
    check((await days.count()) > 1, `${width}: day switcher`);
    let ideaListed = false;
    for (let index = 0; index < (await days.count()); index += 1) {
      await days.nth(index).click();
      if ((await sheet.innerText()).includes("Idea Gallery")) ideaListed = true;
    }
    check(!ideaListed, `${width}: an idea is not listed as a stop of any day`);
    await days.nth(1).click();
    check((await days.nth(1).getAttribute("aria-pressed")) === "true", `${width}: selected day`);
    const canvas = await page.locator(".trip-map-canvas").boundingBox();
    const panel = await page.locator(".workspace-panel--map").boundingBox();
    check(canvas.height >= panel.height - 2 && canvas.height > 500, `${width}: canvas fills tab`);
    await sheet.locator(".phone-map-sheet__stops button").first().click();
    check((await sheet.getAttribute("data-snap")) === "handle", `${width}: stop exposes map`);
    const popup = page.locator(".phone-map-details");
    await popup.waitFor();
    check(await popup.isVisible(), `${width}: no-key fallback details use bottom sheet`);
    const controls = await page.locator(".map-control").evaluateAll((nodes) =>
      nodes.map((node) => {
        const b = node.getBoundingClientRect();
        return { width: b.width, height: b.height, bottom: b.bottom };
      }),
    );
    const detailBox = await popup.boundingBox();
    check(
      controls.length === 4 &&
        controls.every((b) => b.width >= 44 && b.height >= 44 && b.bottom <= detailBox.y),
      `${width}: controls clear details and >=44`,
    );
    await page.screenshot({ path: `${OUT}/${width}-details.png` });
    await popup.getByRole("button", { name: "Close place details" }).click();
    await handle.press("End");
    await sheet.locator(".phone-map-sheet__stops button").first().click();
    await popup.waitFor();
    check(await popup.isVisible(), `${width}: same-stop selection reopens closed details`);
    await page.waitForTimeout(100);
    await page.evaluate(() => history.back());
    await page.waitForTimeout(350);
    check(
      !(await popup.isVisible()) && (await sheet.isVisible()),
      `${width}: Back closes details and retains stops sheet`,
    );
    await handle.press("End");
    await page.waitForTimeout(100);
    await page.evaluate(() => history.back());
    await page.waitForTimeout(350);
    check(
      (await sheet.getAttribute("data-snap")) === "handle",
      `${width}: Back collapses expanded day stops`,
    );
    await handle.press("End");
    await page.screenshot({ path: `${OUT}/${width}-stops.png` });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.waitForTimeout(150);
    const darkSelection = await sheet
      .locator('.phone-map-sheet__days button[aria-pressed="true"]')
      .evaluate((button) => {
        const sample = document.createElement("span");
        sample.style.backgroundColor = "var(--accent-bg)";
        button.append(sample);
        const token = getComputedStyle(sample).backgroundColor;
        sample.remove();
        return getComputedStyle(button).backgroundColor === token;
      });
    check(darkSelection, `${width}: dark selected day uses semantic accent background`);
    await page.screenshot({ path: `${OUT}/${width}-stops-dark.png` });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await tab("Mine").click();
    const chinese = page.getByRole("button", { name: /中文|Chinese/ });
    if (await chinese.count()) {
      await chinese.first().click();
      await page.locator(".phone-tabbar").getByRole("tab", { name: /^地图/ }).click();
      check(
        await sheet.innerText().then((text) => text.includes("当日站点")),
        `${width}: Chinese labels`,
      );
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator(".trip-map-fallback ol button").first().click();
    check(
      await page.locator(".trip-map-popup:not(.phone-map-details)").isVisible(),
      `${width}: desktop retains popup`,
    );
    await page.screenshot({ path: `${OUT}/${width}-desktop-popup.png` });
    check(!errors.length, `${width}: no page errors (${errors.join(", ")})`);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      { results, passed: results.filter((r) => r.ok).length, total: results.length },
      null,
      2,
    ),
  );
}
if (results.some((r) => !r.ok)) process.exitCode = 1;
