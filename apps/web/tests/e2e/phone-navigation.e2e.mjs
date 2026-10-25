import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/phone-navigation");
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
      id: "untitled-chat",
      title: "New chat",
      updatedAt: savedAt,
      messages: [],
      input: "",
    },
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
const browser = await chromium.launch({ headless: true });
try {
  for (const language of ["en", "zh"]) {
    for (const width of [360, 375, 390, 520]) {
      const context = await browser.newContext({
        locale: language === "zh" ? "zh-CN" : "en-AU",
        viewport: { width, height: 844 },
        hasTouch: true,
        isMobile: true,
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        ({ catalog, language }) => {
          if (!localStorage.getItem("trip-workspace-catalog-v3")) {
            localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
            localStorage.setItem(
              "trip.settings.v1",
              JSON.stringify({
                version: 1,
                language,
                travel: { homeCity: "", preferences: [] },
                dataMode: "mock",
                appearance: "system",
                updatedAt: "2026-10-05T00:00:00Z",
              }),
            );
          }
        },
        { catalog, language },
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(BASE);
      await page.locator(".phone-tabbar").waitFor();
      await page.waitForTimeout(400);
      await page.addStyleTag({ content: "nextjs-portal {display:none!important}" });
      await page.locator(".phone-mine .trip-card").first().click();
      await page.locator("#phone-tab-trip").waitFor();
      await page.locator("#phone-tab-mine").click();
      const label = `${language}-${width}`;
      const tabs = page.locator(".phone-tabbar [role=tab]");
      check((await tabs.count()) === 4, `${label}: four primary tabs with a plan`);
      check(
        !(await tabs.allTextContents()).some((text) => /Trajectory|轨迹/.test(text)),
        `${label}: trajectory is outside primary tabs`,
      );
      const mine = page.locator(".phone-mine");
      check(
        (await mine
          .locator(".chats-panel__section")
          .first()
          .getByRole("button", { name: language === "en" ? "New trip" : "新行程", exact: true })
          .count()) === 1,
        `${label}: trip creation belongs to Trips`,
      );
      check(
        (await mine
          .locator(".chats-panel__section")
          .last()
          .locator(".chats-panel__section-head .chats-panel__action")
          .count()) === 1,
        `${label}: chat creation belongs to Chats`,
      );
      for (const view of ["map", "mine", "chat", "trip"]) {
        await page.locator(`#phone-tab-${view}`).click();
        const trigger = page.locator(".phone-topbar__team");
        await trigger.click();
        const dialog = page.locator("dialog.phone-trajectory[open]");
        if (!(await dialog.count())) {
          check(false, `${label}: team opens full-screen trajectory`);
          await page.keyboard.press("Escape");
          break;
        }
        const box = await dialog.boundingBox();
        const closeBox = await dialog.locator(".phone-trajectory__close").boundingBox();
        check(
          closeBox.width >= 44 && closeBox.height >= 44,
          `${label}-${view}: close target is 44px`,
        );
        check(
          box.x === 0 &&
            box.y === 0 &&
            Math.abs(box.width - width) <= 1 &&
            Math.abs(box.height - 844) <= 1,
          `${label}-${view}: trajectory fills viewport`,
        );
        check(
          await dialog.evaluate((node) => node.contains(document.activeElement)),
          `${label}-${view}: trajectory owns focus`,
        );
        await dialog.locator(".phone-trajectory__close").click();
        check(
          (await page.locator(`#phone-tab-${view}`).getAttribute("aria-selected")) === "true",
          `${label}-${view}: close restores origin`,
        );
        check(
          await trigger.evaluate((node) => node === document.activeElement),
          `${label}-${view}: close returns focus`,
        );
      }
      if (await page.locator("dialog.phone-trajectory").count()) {
        await page.locator(".phone-topbar__team").click();
        await page.locator("dialog.phone-trajectory[open]").waitFor();
        await page.screenshot({ path: resolve(OUT, `${label}-trajectory.png`) });
        await page.goBack();
        await page.waitForTimeout(100);
        check(
          !(await page.locator("dialog.phone-trajectory[open]").count()),
          `${label}: Browser Back closes trajectory`,
        );
        check(
          await page
            .locator(".phone-topbar__team")
            .evaluate((node) => node === document.activeElement),
          `${label}: Browser Back restores trigger focus`,
        );
      }
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${label}: no page overflow`,
      );
      await page.locator("#phone-tab-mine").click();
      await page.locator('#phone-tab-mine[aria-selected="true"]').waitFor();
      await page.screenshot({ path: resolve(OUT, `${label}-mine.png`) });
      check(errors.length === 0, `${label}: no page errors`);
      if (width === 360) {
        for (const colorScheme of ["light", "dark"]) {
          await page.emulateMedia({
            colorScheme,
            forcedColors: colorScheme === "dark" ? "active" : "none",
            reducedMotion: "reduce",
          });
          await page.locator(".phone-topbar__team").click();
          const dialog = page.locator("dialog.phone-trajectory[open]");
          await dialog.waitFor();
          check(
            await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
            `${label}: ${colorScheme} trajectory fits`,
          );
          await page.screenshot({ path: resolve(OUT, `${label}-${colorScheme}.png`) });
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
        }
      }
      await context.close();
    }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() =>
    localStorage.setItem("trip.settings.v1", JSON.stringify({ language: "en", tripData: "mock" })),
  );
  const page = await context.newPage();
  await page.goto(BASE);
  await page.locator(".phone-tabbar").waitFor();
  check(
    (await page.locator(".phone-tabbar [role=tab]").count()) === 3,
    "empty workspace has three primary tabs",
  );
  await page.locator(".phone-topbar__team").click();
  await page.locator("dialog.phone-trajectory[open]").waitFor();
  for (const width of [521, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    check(
      !(await page.locator(".phone-tabbar").count()),
      `${width}: desktop navigation remains separate`,
    );
    check(
      !(await page.locator("dialog.phone-trajectory[open]").count()),
      `${width}: phone modal is closed`,
    );
    await page.screenshot({ path: resolve(OUT, `${width}-workspace.png`) });
  }
  await context.close();
} finally {
  await browser.close();
  writeFileSync(resolve(OUT, "summary.json"), JSON.stringify({ results }, null, 2));
}
if (results.some((result) => !result.ok)) process.exitCode = 1;
