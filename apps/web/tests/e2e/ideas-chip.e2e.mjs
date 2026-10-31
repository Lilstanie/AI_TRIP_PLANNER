import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor, sleep, waitUntil } from "./trip-setup.mjs";
import { openTripWorkspace } from "./support/e2e-helpers.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/ideas-chip",
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

const STORED_PREFERENCE = "trip.show-distances.v1";
const core = (items) =>
  items
    .filter((item) => item.kind === "activity")
    .map(({ id, day, startTime, endTime, location }) => ({ id, day, startTime, endTime, location }))
    .sort((left, right) => left.id.localeCompare(right.id));

try {
  for (const viewport of [
    { width: 1440, height: 1500 },
    { width: 390, height: 844 },
    { width: 1440, height: 1500, zh: true },
  ]) {
    const phone = viewport.width <= 520;
    const zh = Boolean(viewport.zh);
    const tag = `${viewport.width}px${zh ? " zh" : ""}`;
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
      ...(phone ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await context.newPage();
    currentPage = page;
    const pageErrors = [];
    const editRequests = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", (dialog) => void dialog.accept());
    page.on("request", (request) => {
      if (request.url().endsWith("/api/trip/preview-edit"))
        editRequests.push(request.postDataJSON());
    });
    await page.route("**/api/places/details", (route) => {
      const { placeId } = route.request().postDataJSON();
      return route.fulfill({ json: { place: placeFor(placeId.replace(/^stub:/, "")) } });
    });
    await page.route("**/api/trip/preview-edit", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      if (Array.isArray(body.routes))
        body.routes = body.routes.map((leg) => ({ ...leg, distanceMeters: 1800 }));
      return route.fulfill({ response, json: body });
    });
    await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));

    const tripId = `ideas-trip-${viewport.width}${zh ? "-zh" : ""}`;
    const activity = (name, day, startTime, endTime) => ({
      id: `${name.toLowerCase()}-${viewport.width}`,
      kind: "activity",
      ...(day === undefined ? {} : { day, startTime, endTime }),
      location: name,
      detail: name,
      placeId: placeFor(name).id,
    });
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
      estTotal: 200,
      overrunPct: -90,
      sections: [
        {
          id: "itinerary",
          label: "Day plan",
          status: "draft",
          summary: "Sydney visit",
          estCost: 200,
          proposal: {
            agent: "itinerary",
            summary: "Sydney visit",
            items: [
              activity("Alder", 1, "09:00", "10:00"),
              activity("Birch", 1, "11:00", "12:00"),
              activity("Elm", 2, "11:00", "12:00"),
              activity("Fir", undefined, undefined, undefined),
              activity("Gum", undefined, undefined, undefined),
            ],
            assumptions: [],
            conflictsWith: [],
          },
        },
      ],
    };
    const conversationId = `ideas-conversation-${viewport.width}${zh ? "-zh" : ""}`;
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
          title: "Sydney ideas",
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
          title: "Sydney ideas",
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
    await page.addInitScript(
      ({ catalog, savedAt, zh, stored }) => {
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        localStorage.setItem(stored, "0");
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({
            version: 1,
            language: zh ? "zh" : "en",
            dataMode: "mock",
            travel: { homeCity: "", preferences: [] },
            appearance: "system",
            updatedAt: savedAt,
          }),
        );
      },
      { catalog, savedAt, zh, stored: STORED_PREFERENCE },
    );
    await page.goto(BASE);
    await page.locator(".workspace-app").waitFor();
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    const openTrip = async () => {
      if (phone) {
        await page.getByRole("tab", { name: /^(Mine|我的)$/ }).click();
        await openTripWorkspace(
          page,
          page.locator(".phone-mine .trip-card").filter({ hasText: "Sydney" }).first(),
        );
        const tripTab = page.getByRole("tab", { name: /^(Trip|行程)$/ });
        if (await tripTab.count()) await tripTab.click();
      } else {
        await page.getByRole("button", { name: /^(Trips|行程)/ }).click();
        await openTripWorkspace(
          page,
          page.locator(".trips-page .trip-card").filter({ hasText: "Sydney" }).first(),
        );
        const toggle = page.locator(".trip-trigger");
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      }
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
    const saved = () =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
        const found = stored?.trips?.find((trip) => trip.id === stored.activeTripId);
        return (
          found?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal
            ?.items ?? []
        );
      });
    const itemOf = async (name) => (await saved()).find((item) => item.location === name);
    const dayOf = async (name) => (await itemOf(name))?.day;
    const waitDay = (name, day) => waitUntil(async () => (await dayOf(name)) === day, 10_000);
    const dayPanel = timeline.locator(".timeline-day");
    const rows = dayPanel.locator(".timeline-stop");
    const rowIn = (scope, name) =>
      scope.filter({ has: page.locator(".timeline-stop__name", { hasText: name }) }).first();
    const row = (name) => rowIn(rows, name);
    const names = async (scope) =>
      (await scope.locator(".timeline-stop__name").allTextContents()).map((text) =>
        text.replace(/^(Stop \d+|第 \d+ 站)[:：]\s*/, "").trim(),
      );
    const shownNames = () => names(rows);
    const shownNumbers = async () =>
      (await rows.locator(".timeline-stop__node").allTextContents()).map((text) => text.trim());
    const strip = timeline.locator(".day-strip");
    const chip = (day) => strip.locator(`[data-day="${day}"]`);
    const line = timeline.locator(".timeline-drop-line");
    const undoButton = page.getByRole("button", {
      name: /^(Undo( last change)?|撤销|撤销刚才的修改)$/,
    });
    const requests = (kind) => editRequests.filter((request) => request.operation.kind === kind);
    const requestCount = () => editRequests.length;

    const cdp = phone ? await context.newCDPSession(page) : undefined;
    const touchSend = (type, x, y) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
      });
    let pos = { x: 0, y: 0 };
    const begin = async (scope, name) => {
      await scope.locator(".timeline-stop__name").first().waitFor();
      const handle = await rowIn(scope, name).locator(".timeline-stop__name").first();
      await handle.scrollIntoViewIfNeeded();
      const box = await handle.boundingBox();
      pos = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      if (phone) {
        await touchSend("touchStart", pos.x, pos.y);
        await sleep(700);
      } else {
        await page.mouse.move(pos.x, pos.y);
        await page.mouse.down();
        await page.mouse.move(pos.x, pos.y + 12);
        pos.y += 12;
      }
    };
    const go = async (x, y) => {
      const steps = 8;
      const from = pos;
      for (let step = 1; step <= steps; step += 1) {
        const px = from.x + ((x - from.x) * step) / steps;
        const py = from.y + ((y - from.y) * step) / steps;
        if (phone) await touchSend("touchMove", px, py);
        else await page.mouse.move(px, py);
      }
      pos = { x, y };
    };
    const centre = async (locator) => {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
    };
    const release = async () => {
      if (phone) await touchSend("touchEnd", 0, 0);
      else await page.mouse.up();
      await sleep(250);
    };
    const ideasChip = timeline.locator("button.timeline-ideas-chip");
    const ideasName = (count) =>
      zh ? `${count} 个备选地点` : `${count} ${count === 1 ? "idea" : "ideas"}`;
    const toIdeas = async () => {
      const target = await centre(ideasChip);
      await go(target.x, target.y);
    };
    const panel = page.getByRole("region", { name: /^(Add to trip|添加到行程)$/ });
    const ideasTab = panel.getByRole("tab", { name: /^(Ideas|备选地点)$/ });
    const ideasOf = async () =>
      (await saved())
        .filter((item) => item.kind === "activity" && item.day === undefined)
        .map((item) => item.location)
        .sort();
    const stopMenu = (name) =>
      page.getByRole("button", {
        name: zh ? new RegExp(`^${name}（.*）的操作$`) : new RegExp(`^Actions for ${name}, `),
      });
    const baseline = JSON.stringify(core(await saved()));
    const restored = async (label) => {
      await undoButton.first().click();
      const ok = await waitUntil(
        async () => JSON.stringify(core(await saved())) === baseline,
        10_000,
      );
      check(ok, `Undo restores the saved plan after ${label} at ${tag}`);
      await chip(1).click();
    };
    const countIs = (count) =>
      waitUntil(
        async () =>
          (await ideasChip.count()) === 1 && (await ideasChip.innerText()) === ideasName(count),
        8000,
      );
    const unchanged = async (label, before) => {
      await sleep(500);
      check(
        requestCount() === before &&
          JSON.stringify(core(await saved())) === baseline &&
          (await line.count()) === 0,
        `${label} changes nothing and leaves no line at ${tag}`,
        { requests: requestCount() - before },
      );
    };

    check(
      (await timeline.getByRole("heading", { name: /^(Ideas|备选地点)$/ }).count()) === 0 &&
        (await timeline
          .getByRole("button", { name: /^(Add to Ideas|添加到备选地点)$/ })
          .count()) === 0,
      `no Ideas section, heading or Add to Ideas button renders at ${tag}`,
    );
    check(
      (await timeline.getByRole("switch").count()) === 0 &&
        (await timeline.getByText(/Show distances|显示距离/).count()) === 0,
      `no Show distances switch renders at ${tag}`,
    );
    check(
      (await ideasChip.count()) === 1 && (await ideasChip.innerText()) === ideasName(2),
      `the chip reads the number of parked places at ${tag}`,
      await ideasChip.allInnerTexts(),
    );
    check(
      (await timeline.getByRole("button", { name: ideasName(2), exact: true }).count()) === 1,
      `the chip has an accessible name at ${tag}`,
    );
    const chipBox = await ideasChip.boundingBox();
    const stripBox = await strip.boundingBox();
    check(
      chipBox.y < stripBox.y && chipBox.height >= 44 && chipBox.x + chipBox.width <= viewport.width,
      `the chip sits above Day 1, is at least 44 px tall and fits the screen at ${tag}`,
      { chip: chipBox, strip: stripBox.y },
    );
    check(
      (await shownNames()).join() === "Alder,Birch",
      `Day 1 lists its two stops and no idea at ${tag}`,
      await shownNames(),
    );
    const legs = timeline.locator(".timeline-connection");
    check(
      (await legs.count()) >= 1 &&
        (await legs.locator(".timeline-connection__distance").count()) >= 1 &&
        (await legs.getByRole("link", { name: /Directions|路线/ }).count()) >= 1,
      `legs show mode, distance and Directions although the old preference is stored as off at ${tag}`,
      await legs.allInnerTexts(),
    );
    check(
      (await page.evaluate((key) => localStorage.getItem(key), STORED_PREFERENCE)) === "0",
      `nothing writes the old Show distances preference at ${tag}`,
    );
    await page.screenshot({
      path: resolve(out, `panel-${viewport.width}${zh ? "-zh" : ""}.png`),
      fullPage: true,
    });

    await ideasChip.click();
    await panel.waitFor();
    check(
      (await ideasTab.getAttribute("aria-selected")) === "true",
      `the chip opens the Add to trip panel on its Ideas tab at ${tag}`,
    );
    check(
      (await panel
        .getByRole("list", { name: /^(Ideas|备选地点)$/ })
        .locator("li")
        .count()) === 2,
      `the Ideas tab lists the two parked places at ${tag}`,
    );
    await page.screenshot({
      path: resolve(out, `chip-open-${viewport.width}${zh ? "-zh" : ""}.png`),
      fullPage: true,
    });
    let before = requestCount();
    await panel.getByRole("button", { name: zh ? "添加：Fir" : "Add Fir", exact: true }).click();
    check(await waitDay("Fir", 1), `choosing an idea schedules it on the selected day at ${tag}`);
    check(
      requests("schedule").at(-1)?.operation.day === 1 && requestCount() === before + 1,
      `scheduling from the chip is one edit at ${tag}`,
      { requests: requestCount() - before },
    );
    check(
      await countIs(1),
      `the chip counts one idea after one is scheduled at ${tag}`,
      await ideasChip.allInnerTexts(),
    );
    if (await panel.count()) await panel.getByRole("button", { name: /^(Close|关闭)$/ }).click();
    await restored("scheduling from the chip");
    check(await countIs(2), `Undo brings the count back to two at ${tag}`);

    before = requestCount();
    await begin(rows, "Alder");
    await toIdeas();
    check(
      (await ideasChip.getAttribute("data-drop-target")) === "true",
      `the chip is marked as the drop target while a stop is dragged at ${tag}`,
    );
    await page.screenshot({
      path: resolve(out, `chip-target-${viewport.width}${zh ? "-zh" : ""}.png`),
      fullPage: true,
    });
    await release();
    check(
      await waitUntil(async () => (await dayOf("Alder")) === undefined, 10_000),
      `a drop on the chip unschedules the stop at ${tag}`,
    );
    const parked = await itemOf("Alder");
    check(
      requestCount() === before + 1 &&
        requests("idea").at(-1)?.operation.id === parked.id &&
        !parked.startTime &&
        !parked.endTime,
      `a drop on the chip is one idea edit that clears the times at ${tag}`,
      { requests: requestCount() - before },
    );
    check(
      await countIs(3),
      `the chip counts three ideas after the drop at ${tag}`,
      await ideasChip.allInnerTexts(),
    );
    check(
      (await ideasChip.getAttribute("data-drop-target")) === null,
      `the drop marker clears after the drop at ${tag}`,
    );
    check(
      (await waitUntil(async () => (await shownNames()).join() === "Birch", 5000)) &&
        (await shownNumbers()).join() === "1",
      `Day 1 renumbers after the drop at ${tag}`,
      { names: await shownNames(), numbers: await shownNumbers() },
    );
    check(
      (await page
        .getByRole("button", { name: /^(Undo( last change)?|撤销|撤销刚才的修改)$/ })
        .count()) >= 1,
      `the drop offers an Undo at ${tag}`,
    );
    await restored("a drop on the chip");
    check(
      (await countIs(2)) && (await ideasOf()).join() === "Fir,Gum",
      `Undo restores the idea count at ${tag}`,
      await ideasOf(),
    );

    await stopMenu("Alder").click();
    await page
      .getByRole("menuitem", { name: zh ? "移到备选地点" : "Move to ideas", exact: true })
      .click();
    check(
      await waitUntil(async () => (await dayOf("Alder")) === undefined, 10_000),
      `Move to ideas in the stop menu still parks a stop at ${tag}`,
    );
    check(await countIs(3), `the chip counts the stop parked from its menu at ${tag}`);
    await restored("Move to ideas");

    before = requestCount();
    await begin(rows, "Alder");
    await toIdeas();
    await page.keyboard.press("Escape");
    await release();
    await unchanged("Escape over the chip", before);

    await ideasChip.click();
    await panel.waitFor();
    await chip(2).click();
    check(
      await waitUntil(async () => (await panel.count()) === 0, 4000),
      `the panel opened from the chip closes when the day changes at ${tag}`,
    );
    await chip(1).click();

    await ideasChip.click();
    await panel.getByRole("button", { name: zh ? "添加：Fir" : "Add Fir", exact: true }).click();
    await waitDay("Fir", 1);
    await ideasChip.click();
    await panel.getByRole("button", { name: zh ? "添加：Gum" : "Add Gum", exact: true }).click();
    await waitDay("Gum", 1);
    check(
      await waitUntil(async () => (await ideasChip.count()) === 0, 8000),
      `the chip is hidden when no idea is left at ${tag}`,
    );
    check(
      await waitUntil(async () => (await panel.count()) === 0, 4000),
      `the panel closes after the last idea is scheduled at ${tag}`,
    );
    await page.screenshot({
      path: resolve(out, `no-ideas-${viewport.width}${zh ? "-zh" : ""}.png`),
      fullPage: true,
    });
    await undoButton.first().click();
    check(
      (await countIs(1)) &&
        (await waitUntil(async () => (await ideasOf()).join() === "Gum", 10_000)),
      `Undo of the last schedule brings the chip back with one idea at ${tag}`,
      await ideasOf(),
    );
    await stopMenu("Fir").click();
    await page
      .getByRole("menuitem", { name: zh ? "移到备选地点" : "Move to ideas", exact: true })
      .click();
    check(
      (await countIs(2)) &&
        (await waitUntil(async () => JSON.stringify(core(await saved())) === baseline, 10_000)),
      `Move to ideas returns the plan and the chip to the start at ${tag}`,
      await ideasChip.allInnerTexts(),
    );

    if (!phone && !zh) {
      const toggle = page.getByRole("button", { name: "Open your trip", exact: true });
      await toggle.click();
      let held;
      await page.route("**/api/chat", (route) => {
        held = route;
      });
      const input = page.getByRole("textbox", { name: "Message AI Trip Planner", exact: true });
      await input.fill("Make day one lighter");
      await input.press("Enter");
      await waitUntil(() => !!held, 8000);
      await toggle.click();
      await timeline.waitFor();
      before = requestCount();
      check(await ideasChip.isDisabled(), "a running assistant disables the chip");
      await begin(rows, "Alder");
      await toIdeas();
      const lockedMark = await ideasChip.getAttribute("data-drop-target");
      await release();
      await unchanged("a drop on the chip while the assistant is running", before);
      check(
        lockedMark !== "true",
        "a running assistant keeps the chip from becoming a drop target",
      );
      await held?.abort();
      await page.unroute("**/api/chat");
    }

    check(pageErrors.length === 0, `no page errors at ${tag}`, pageErrors);
    await page.screenshot({
      path: resolve(out, `final-${viewport.width}${zh ? "-zh" : ""}.png`),
      fullPage: true,
    });
    await context.close();
  }
} catch (error) {
  check(false, "ideas chip workflow completed without an exception", String(error));
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
