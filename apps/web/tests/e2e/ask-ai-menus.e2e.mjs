import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor, waitUntil } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/ask-ai-menus",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const savedAt = "2026-10-27T00:00:00Z";
const BASE = process.env.BASE_URL ?? "http://localhost:3115";
const browser = await chromium.launch({ channel: process.env.CHANNEL });
let currentPage;

try {
  for (const viewport of [
    { width: 1440, height: 1500 },
    { width: 390, height: 844 },
    { width: 1440, height: 1500, zh: true },
  ]) {
    const phone = viewport.width <= 520;
    const tag = `${viewport.width}px${viewport.zh ? " zh" : ""}`;
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
      ...(phone ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await context.newPage();
    currentPage = page;
    const pageErrors = [];
    const dialogs = [];
    const editRequests = [];
    const chatRequests = [];
    let holdChat;
    await page.route("**/api/chat", async (route) => {
      chatRequests.push(route.request().postDataJSON());
      if (holdChat) await holdChat;
      return route.fulfill({ status: 503, json: { error: "Fixture reply failure" } });
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.accept();
    });
    page.on("request", (request) => {
      if (request.url().endsWith("/api/trip/preview-edit"))
        editRequests.push(request.postDataJSON());
    });
    await page.route("**/api/places/details", (route) => {
      const { placeId } = route.request().postDataJSON();
      return route.fulfill({ json: { place: placeFor(placeId.replace(/^stub:/, "")) } });
    });
    await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));

    const tripId = `ask-trip-${viewport.width}${viewport.zh ? "-zh" : ""}`;
    const activity = (name, day, startTime, endTime) => ({
      id: `${name.toLowerCase()}-${viewport.width}`,
      kind: "activity",
      ...(day === undefined ? {} : { day, startTime, endTime }),
      location: name,
      detail: name,
      placeId: placeFor(name).id,
    });
    const candidate = {
      id: "room-1",
      name: "Harbour Inn",
      area: "Circular Quay",
      pricePerNight: 100,
      rating: 8,
    };
    const plan = {
      tripId,
      brief: {
        tripId,
        userId: "local",
        destination: "Sydney",
        dates: ["2030-10-01", "2030-10-04"],
        groupSize: 2,
        budgetTotal: 2000,
      },
      round: 1,
      budgetTotal: 2000,
      estTotal: 300,
      overrunPct: -85,
      sections: [
        {
          id: "itinerary",
          label: "Day plan",
          status: "draft",
          summary: "Sydney visit",
          estCost: 0,
          proposal: {
            agent: "itinerary",
            summary: "Sydney visit",
            items: [
              activity("Alder", 1, "09:00", "10:00"),
              activity("Birch", 1, "11:00", "12:00"),
              activity("Elm", 2, "11:00", "12:00"),
              activity("Gum", 3, "10:00", "11:00"),
              activity("Fir", undefined, undefined, undefined),
              {
                id: `nameless-${viewport.width}`,
                kind: "activity",
                day: 2,
                startTime: "14:00",
                endTime: "15:00",
                detail: "Walk the harbour",
              },
            ],
            assumptions: [],
            conflictsWith: [],
          },
        },
        {
          id: "accommodation",
          label: "Stay",
          status: "draft",
          summary: "Harbour Inn",
          estCost: 300,
          proposal: {
            agent: "accommodation",
            summary: "Harbour Inn",
            items: [
              {
                id: "stay-item",
                kind: "stay",
                day: 1,
                selectionId: "stay-1",
                detail:
                  "Harbour Inn — Circular Quay; 2030-10-01 to 2030-10-04; 1 room × 3 nights × A$100.00 per room/night = A$300.00; rating 4.0/5; cancellation terms unknown.",
                estCost: 300,
              },
            ],
            assumptions: [],
            conflictsWith: [],
            stays: [
              {
                id: "stay-1",
                city: "Sydney",
                checkIn: "2030-10-01",
                checkOut: "2030-10-04",
                day: 1,
                nights: 3,
                rooms: 1,
                selectedId: "room-1",
                candidates: [candidate],
              },
            ],
          },
        },
      ],
    };
    const conversationId = `ask-conversation-${viewport.width}${viewport.zh ? "-zh" : ""}`;
    const snapshot = {
      version: 4,
      id: conversationId,
      savedAt,
      plan,
      draft: {
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
      },
      messages: [],
      input: "",
    };
    const catalog = {
      version: 4,
      activeConversationId: conversationId,
      activeTripId: tripId,
      conversations: [
        {
          id: conversationId,
          title: "Sydney ask",
          updatedAt: savedAt,
          tripId,
          messages: [],
          input: "",
          snapshot,
        },
      ],
      trips: [
        {
          id: tripId,
          title: "Sydney ask",
          status: "draft",
          updatedAt: savedAt,
          conversationIds: [conversationId],
          snapshot,
        },
      ],
      layout: {
        sidebar: { collapsed: false },
        preferences: { width: 280 },
        trip: { width: 340 },
        view: "chat",
        editorView: "timeline",
      },
    };
    if (viewport.zh) await page.addInitScript(() => sessionStorage.setItem("lang", "zh"));
    await page.addInitScript(
      ({ catalog, savedAt }) => {
        if (!sessionStorage.getItem("seeded")) {
          sessionStorage.setItem("seeded", "1");
          localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        }
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({
            version: 1,
            language: sessionStorage.getItem("lang") ?? "en",
            dataMode: "mock",
            travel: { homeCity: "", preferences: [] },
            appearance: "system",
            updatedAt: savedAt,
          }),
        );
      },
      { catalog, savedAt },
    );
    await page.goto(BASE);
    await page.locator(".workspace-app").waitFor();
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    const openTrip = async (again = false) => {
      if (again && (await page.locator("section.trip-editor").count())) return;
      const pick = (cards) => (again ? cards.last() : cards.first());
      if (phone) {
        await page.getByRole("tab", { name: /^(Mine|我的)$/ }).click();
        await pick(page.locator(".phone-mine .trip-card").filter({ hasText: "Sydney" })).click();
        const tripTab = page.getByRole("tab", { name: /^(Trip|行程)$/ });
        if (await tripTab.count()) await tripTab.click();
      } else {
        await page.getByRole("button", { name: /^(Trips|行程)/ }).click();
        await pick(page.locator(".trips-page .trip-card").filter({ hasText: "Sydney" })).click();
        const toggle = page.locator(".trip-trigger");
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      }
      await page.locator("section.trip-editor").waitFor({ timeout: 8000 });
    };
    await openTrip();
    const timeline = page.getByRole("region", { name: /^(Trip timeline|行程时间线)$/ });
    await timeline.waitFor({ timeout: 8000 }).catch(() => undefined);
    if (!(await timeline.count())) {
      await page.screenshot({ path: resolve(out, `setup-${viewport.width}.png`), fullPage: true });
      check(false, `saved Trip fixture opens at ${tag}`, { errors: pageErrors });
      await context.close();
      continue;
    }

    const selectedDay = () =>
      page.locator('.day-strip__day[aria-selected="true"]').getAttribute("data-day");
    const menuOf = (name) => page.getByRole("button", { name, exact: true });
    const selectDay = async (day) => {
      await page.locator(`.day-strip__day[data-day="${day}"]`).click();
      await waitUntil(async () => (await selectedDay()) === String(day), 4000);
    };
    const reopen = async () => {
      if (phone) await page.getByRole("tab", { name: /^(Trip|行程)$/ }).click();
      else {
        const toggle = page.locator(".trip-trigger");
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      }
      await page.locator("section.trip-editor").waitFor({ state: "visible", timeout: 8000 });
    };
    const zh = Boolean(viewport.zh);
    const askLabel = zh ? "询问 AI" : "Ask AI";
    const dayMenuName = (day) => (zh ? `第 ${day} 天的操作` : `Day ${day} actions`);
    const stopMenu = (name) =>
      page.getByRole("button", {
        name: zh ? new RegExp(`^${name}，.*的操作$`) : new RegExp(`^Actions for ${name}, `),
      });
    const dayMessage = (day) =>
      zh
        ? `请结合当前行程，优化第 ${day} 天的安排。`
        : `Suggest improvements for Day ${day}, taking the rest of my current plan into account.`;
    const stopMessage = (name, day) =>
      zh
        ? `请结合当前行程，调整第 ${day} 天的 ${name} 安排。`
        : `Suggest a change for ${name} on Day ${day}, taking the rest of my current plan into account.`;
    const askItem = () => page.getByRole("menuitem", { name: askLabel, exact: true });
    const lastMessage = () => chatRequests.at(-1)?.message;
    const barCount = () => page.getByRole("button", { name: /Ask AI about|向 AI 咨询/ }).count();

    await selectDay(1);
    check((await barCount()) === 0, `no Ask AI bar renders on a day with stops at ${tag}`);
    check(
      (await page
        .locator("section.trip-editor")
        .getByText(/Ask AI about|向 AI 咨询/)
        .count()) === 0,
      `no Ask AI text renders in the Trip panel at ${tag}`,
    );
    await selectDay(4);
    check((await barCount()) === 0, `no Ask AI bar renders on a day with no stops at ${tag}`);
    await page.screenshot({
      path: resolve(out, `no-bar-${viewport.width}${zh ? "-zh" : ""}.png`),
      fullPage: true,
    });

    await selectDay(1);
    await stopMenu("Alder").click();
    check(
      (await askItem().count()) === 1 && (await askItem().isEnabled()),
      `the stop menu offers an enabled Ask AI item at ${tag}`,
    );
    await page.screenshot({
      path: resolve(out, `stop-menu-${viewport.width}${zh ? "-zh" : ""}.png`),
      fullPage: true,
    });
    await askItem().click();
    await waitUntil(() => chatRequests.length === 1, 6000);
    check(
      lastMessage() === stopMessage("Alder", 1),
      `the stop item sends the old stop message at ${tag}`,
      lastMessage(),
    );
    check(
      await page.locator(".composer__input").isVisible(),
      `the chat is shown after asking about a stop at ${tag}`,
    );
    await page.screenshot({
      path: resolve(out, `chat-${viewport.width}${zh ? "-zh" : ""}.png`),
      fullPage: true,
    });

    await reopen();
    await selectDay(4);
    await menuOf(dayMenuName(4)).first().click();
    check(
      (await askItem().count()) === 1 && (await askItem().isEnabled()),
      `the day menu offers Ask AI on a day with no stops at ${tag}`,
    );
    await askItem().click();
    await waitUntil(() => chatRequests.length === 2, 6000);
    check(
      lastMessage() === dayMessage(4),
      `the day item sends the old day message at ${tag}`,
      lastMessage(),
    );

    if (!zh) {
      await reopen();
      await selectDay(2);
      await stopMenu("Walk the harbour").click();
      await askItem().click();
      await waitUntil(() => chatRequests.length === 3, 6000);
      check(
        lastMessage() === stopMessage("Walk the harbour", 2) && !/undefined/.test(lastMessage()),
        `a stop with no name is asked about by its detail at ${tag}`,
        lastMessage(),
      );

      await reopen();
      await selectDay(1);
      let release;
      holdChat = new Promise((resolveHold) => (release = resolveHold));
      await menuOf("Day 1 actions").first().click();
      await askItem().click();
      await waitUntil(() => chatRequests.length === 4, 6000);
      await reopen();
      await selectDay(1);
      await menuOf("Day 1 actions").first().click();
      check(
        await askItem().isDisabled(),
        `the day Ask AI item is disabled while the assistant is running at ${tag}`,
      );
      await page.keyboard.press("Escape");
      await stopMenu("Alder").click();
      check(
        await askItem().isDisabled(),
        `the stop Ask AI item is disabled while the assistant is running at ${tag}`,
      );
      await page.keyboard.press("Escape");
      await page.screenshot({
        path: resolve(out, `running-${viewport.width}.png`),
        fullPage: true,
      });
      release();
      holdChat = undefined;
      check(
        chatRequests.length === 4,
        `no second request was sent while running at ${tag}`,
        chatRequests.length,
      );
    }
    check(pageErrors.length === 0, `no page errors at ${tag}`, pageErrors);
    await context.close();
  }
} catch (error) {
  check(false, "ask AI workflow completed without an exception", String(error));
  if (currentPage)
    await currentPage
      .screenshot({ path: resolve(out, "exception.png"), fullPage: true })
      .catch(() => undefined);
} finally {
  await browser.close();
  const passed = checks.length > 0 && checks.every((item) => item.ok);
  writeFileSync(resolve(out, "result.json"), JSON.stringify({ passed, checks }, null, 2));
  if (!passed) process.exitCode = 1;
}
