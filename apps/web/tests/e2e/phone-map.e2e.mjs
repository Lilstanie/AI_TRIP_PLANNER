import { setPhoneLanguage } from "./phone-settings.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { touchSized } from "./trip-setup.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const OUT = resolve("output/playwright/phone-map", process.env.LABEL ?? "after");
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
    [320, 800],
    [360, 800],
    [375, 812],
    [390, 844],
    [400, 800],
    [520, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    let revisited = "";
    page.on("pageerror", (error) => errors.push(String(error)));

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

              const items = section.proposal.items;
              const first = items.find((item) => item.day === 1);
              const revisit = items.find((item) => item.day === 2);
              if (first && revisit) {
                revisit.placeId = first.placeId;
                revisit.location = first.location;
                revisited = first.placeId;
              }

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
    const handle = sheet.locator(".phone-map-sheet__handle");
    await handle.press("Home");
    check((await sheet.getAttribute("data-snap")) === "handle", `${width}: Home collapses`);
    await handle.press("ArrowUp");
    check((await sheet.getAttribute("data-snap")) === "half", `${width}: ArrowUp half`);
    await handle.press("End");
    check((await sheet.getAttribute("data-snap")) === "full", `${width}: End expands`);
    await handle.click();
    check((await sheet.getAttribute("data-snap")) === "handle", `${width}: click cycles`);

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
    for (const language of ["en", "zh"]) {
      await page.locator(".phone-tabbar").getByRole("tab").last().click();
      if (language === "zh") await setPhoneLanguage(page, "zh");
      await page.locator(".phone-tabbar").getByRole("tab").nth(1).click();
      await handle.press("End");
      const heights = await days.evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().height),
      );
      check(
        heights.every(touchSized),
        `${width} ${language}: day heights ${JSON.stringify(heights)} >=44`,
      );
      await days.nth(1).focus();
      await days.nth(1).press("Enter");
      check(
        await days
          .nth(1)
          .evaluate(
            (node) =>
              node === document.activeElement &&
              node.getAttribute("aria-pressed") === "true" &&
              getComputedStyle(node).boxShadow !== "none",
          ),
        `${width} ${language}: day keyboard selection and focus`,
      );
      check(
        await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
        `${width} ${language}: Map has no page overflow`,
      );
      await page.screenshot({ path: `${OUT}/${width}-${language}-days.png` });
      await page.locator(".phone-tabbar").getByRole("tab").nth(2).click();
      for (const selector of [".trip-panel__budget-summary > summary", ".trip-tips > summary"]) {
        const summary = page.locator(selector).filter({ visible: true });
        await summary.scrollIntoViewIfNeeded();
        const height = (await summary.boundingBox()).height;
        check(touchSized(height), `${width} ${language}: ${selector} height ${height} >=44`);
        const open = await summary.evaluate((node) => node.parentElement.open);
        await summary.focus();
        await summary.press("Enter");
        check(
          await summary.evaluate(
            (node, expected) =>
              node === document.activeElement &&
              getComputedStyle(node).boxShadow !== "none" &&
              node.parentElement.open === expected,
            !open,
          ),
          `${width} ${language}: ${selector} keyboard toggles with focus`,
        );
        await summary.press("Space");
        check(
          (await summary.evaluate((node) => node.parentElement.open)) === open,
          `${width} ${language}: ${selector} Space restores disclosure`,
        );
      }
      check(
        await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
        `${width} ${language}: Trip has no page overflow`,
      );
      await page.screenshot({ path: `${OUT}/${width}-${language}-trip.png` });
      for (const desktopWidth of [521, 1440]) {
        await page.setViewportSize({ width: desktopWidth, height: 1000 });
        await page.locator(".workspace-app:not([data-phone])").waitFor();
        const dimensions = await page
          .locator(".trip-panel__budget-summary > summary, .trip-tips > summary")
          .filter({ visible: true })
          .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
        check(
          dimensions.length === 2 && dimensions.every((height) => height === 21),
          `${width} ${language}: ${desktopWidth} desktop summary heights ${JSON.stringify(dimensions)} stay21`,
        );
        check(
          await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
          `${width} ${language}: ${desktopWidth} no page overflow`,
        );
      }
      await page.setViewportSize({ width, height });
      await page.locator(".phone-tabbar").getByRole("tab").nth(2).click();
      check(
        await page
          .locator(".trip-panel__budget-summary > summary")
          .filter({ visible: true })
          .isVisible(),
        `${width} ${language}: Trip reachable after boundary crossing`,
      );
    }
    await page.locator(".phone-tabbar").getByRole("tab").last().click();
    await setPhoneLanguage(page, "en");
    await tab("Map").click();
    await handle.press("End");

    let ideaListed = false;
    for (let index = 0; index < (await days.count()); index += 1) {
      await days.nth(index).click();
      if ((await sheet.innerText()).includes("Idea Gallery")) ideaListed = true;
    }
    check(!ideaListed, `${width}: an idea is not listed as a stop of any day`);

    const map = page.locator(".trip-map-canvas");
    if (process.env.WEB_MAPS_PROVIDER === "google") {
      await map.locator(".trip-map-fallback").waitFor();
      check(true, `${width}: Google-only missing-key renderer shows the error list`);
    } else {
      await map.locator('.google-map[data-map-ready="true"]').waitFor();
      check(
        (await map.locator(".trip-map-fallback").count()) === 0,
        `${width}: default missing-key renderer loads OSM without the error list`,
      );
    }
    const revisitButton = map.getByRole("button", {
      name: new RegExp(`^(?:\\d+\\. )?${revisited}(?: · .+)?$`),
    });
    await days.nth(0).click();
    await revisitButton.waitFor();
    check((await revisitButton.count()) === 1, `${width}: a repeated place is on day 1's map`);
    await days.nth(1).click();
    await revisitButton.waitFor();
    check(
      (await revisitButton.count()) === 1,
      `${width}: a repeated place is still on day 2's map`,
    );
    await days.nth(1).click();
    check((await days.nth(1).getAttribute("aria-pressed")) === "true", `${width}: selected day`);
    const canvas = await page.locator(".trip-map-canvas").boundingBox();
    const panel = await page.locator(".workspace-panel--map").boundingBox();
    check(canvas.height >= panel.height - 2 && canvas.height > 500, `${width}: canvas fills tab`);
    check(!!revisited, `${width}: fixture has a place visited on days 1 and 2`);

    await handle.press("Home");
    await revisitButton.press("Enter");
    const day2Stops = sheet.locator(".phone-map-sheet__stops button");
    await sheet.locator('.phone-map-sheet__stops button[aria-pressed="true"]').waitFor({
      state: "attached",
    });
    const pressed = await day2Stops.evaluateAll((nodes) =>
      nodes.findIndex((node) => node.getAttribute("aria-pressed") === "true"),
    );
    check(pressed >= 0, `${width}: day 2 map place selects day 2's stop`);
    const openDetails = page.locator(".phone-map-details");
    await openDetails.waitFor();
    await openDetails.getByRole("button", { name: "Close place details" }).click();
    await handle.press("End");
    await day2Stops.nth(pressed).click();
    check((await sheet.getAttribute("data-snap")) === "handle", `${width}: stop exposes map`);
    const popup = page.locator(".phone-map-details");
    await popup.waitFor();
    check(await popup.isVisible(), `${width}: map details use bottom sheet`);
    const details = await popup.innerText();
    check(
      details.includes(revisited) && details.includes("Day 2"),
      `${width}: day 2's repeated stop opens day 2 details`,
    );
    const controls = await page.locator(".map-control").evaluateAll((nodes) =>
      nodes.map((node) => {
        const b = node.getBoundingClientRect();
        return { width: b.width, height: b.height, bottom: b.bottom };
      }),
    );
    const detailBox = await popup.boundingBox();
    check(
      controls.length === 4 &&
        controls.every(
          (b) => touchSized(b.width) && touchSized(b.height) && b.bottom <= detailBox.y,
        ),
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
    await setPhoneLanguage(page, "zh");
    await page.locator(".phone-tabbar").getByRole("tab", { name: /^地图/ }).click();
    check(
      await sheet.innerText().then((text) => text.includes("当日站点")),
      `${width}: Chinese labels`,
    );
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator(".workspace-app:not([data-phone])").waitFor();
    await revisitButton.press("Enter");
    await page.locator(".trip-map-popup:not(.phone-map-details)").waitFor();
    check(
      await page.locator(".trip-map-popup:not(.phone-map-details)").isVisible(),
      `${width}: desktop retains popup`,
    );
    await page.screenshot({ path: `${OUT}/${width}-desktop-popup.png` });
    check(!errors.length, `${width}: no page errors (${errors.join(", ")})`);
    await context.close();
  }
} catch (error) {
  check(false, error.message);
  throw error;
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
