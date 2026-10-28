import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor, sleep, waitUntil } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/cross-day-drag",
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

const NAMES = ["Alder", "Birch", "Cedar", "Dogwood"];
const orderOf = (items, day) =>
  items
    .filter((item) => item.kind === "activity" && item.day === day)
    .sort((left, right) => left.startTime.localeCompare(right.startTime))
    .map((item) => item.location);
const core = (items) =>
  items
    .filter((item) => item.kind === "activity")
    .map(({ id, day, startTime, endTime, location }) => ({ id, day, startTime, endTime, location }))
    .sort((left, right) => left.id.localeCompare(right.id));

try {
  for (const viewport of [
    { width: 1440, height: 1500 },
    { width: 390, height: 844 },
  ]) {
    const phone = viewport.width <= 520;
    const tag = `${viewport.width}px`;
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
    await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));

    const tripId = `cross-trip-${viewport.width}`;
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
              activity("Cedar", 1, "13:00", "14:00"),
              activity("Dogwood", 1, "15:00", "16:00"),
              activity("Elm", 2, "11:00", "12:00"),
              activity("Night", 4, "21:00", "22:30"),
              activity("Fir", undefined, undefined, undefined),
            ],
            assumptions: [],
            conflictsWith: [],
          },
        },
      ],
    };
    const conversationId = `cross-conversation-${viewport.width}`;
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
          title: "Sydney cross",
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
          title: "Sydney cross",
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
      ({ catalog, savedAt }) => {
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({
            version: 1,
            language: "en",
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

    if (phone) {
      await page.getByRole("tab", { name: "Mine", exact: true }).click();
      await page.locator(".phone-mine .trip-card").filter({ hasText: "Sydney" }).first().click();
      const tripTab = page.getByRole("tab", { name: "Trip", exact: true });
      if (await tripTab.count()) await tripTab.click();
    } else {
      await page.getByRole("button", { name: /^Trips/ }).click();
      await page.locator(".trips-page .trip-card").filter({ hasText: "Sydney" }).first().click();
      const toggle = page.getByRole("button", { name: "Open your trip", exact: true });
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    }
    const timeline = page.getByRole("region", { name: "Trip timeline" });
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
    const ideasChip = timeline.locator("button.timeline-ideas-chip");
    const rowIn = (scope, name) =>
      scope.filter({ has: page.locator(".timeline-stop__name", { hasText: name }) }).first();
    const row = (name) => rowIn(rows, name);
    const names = async (scope) =>
      (await scope.locator(".timeline-stop__name").allTextContents()).map((text) =>
        text.replace(/^Stop \d+:\s*/, "").trim(),
      );
    const shownNames = () => names(rows);
    const shownNumbers = async () =>
      (await rows.locator(".timeline-stop__node").allTextContents()).map((text) => text.trim());
    const strip = timeline.locator(".day-strip");
    const chip = (day) => strip.locator(`[data-day="${day}"]`);
    const line = timeline.locator(".timeline-drop-line");
    const undoButton = page.getByRole("button", { name: /^Undo( last change)?$/ });
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
    const toChip = async (day) => {
      const target = await centre(chip(day));
      await go(target.x, target.y);
    };
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

    const chipBox = await ideasChip.boundingBox();
    const stripBox = await strip.boundingBox();
    const titleBox = await dayPanel.locator("#timeline-day-title").boundingBox();
    check(
      !!chipBox && chipBox.y < stripBox.y && chipBox.y < titleBox.y,
      `the ideas chip sits above Day 1 at ${tag}`,
      { chip: chipBox?.y, strip: stripBox.y, title: titleBox.y },
    );
    check(
      (await ideasChip.innerText()) === "1 idea" && (await shownNames()).join() === NAMES.join(),
      `the fixture has one idea and four stops on Day 1 at ${tag}`,
      { chip: await ideasChip.innerText(), day: await shownNames() },
    );

    let before = requestCount();
    await begin(rows, "Alder");
    await toChip(3);
    check(
      (await chip(3).getAttribute("data-drop-target")) === "true" && (await line.count()) === 0,
      `an empty day chip is marked as the target while dragging at ${tag}`,
    );
    await page.screenshot({
      path: resolve(out, `chip-target-${viewport.width}.png`),
      fullPage: true,
    });
    await release();
    check(await waitDay("Alder", 3), `a drop on an empty day moves the stop there at ${tag}`);
    const moveRequest = requests("move").at(-1)?.operation;
    check(
      requestCount() === before + 1 && moveRequest?.day === 3 && moveRequest?.index === 0,
      `a drop on an empty day is one move edit to Day 3 position 0 at ${tag}`,
      moveRequest,
    );
    const left = await itemOf("Alder");
    check(
      (await shownNames()).join() === "Birch,Cedar,Dogwood" &&
        (await shownNumbers()).join() === "1,2,3",
      `Day 1 renumbers after a stop leaves for another day at ${tag}`,
      { names: await shownNames(), numbers: await shownNumbers() },
    );
    check(
      (await chip(3).innerText()).includes("1 stop") && !!left.startTime,
      `the day strip counts and the stop has a time after the drop at ${tag}`,
      { chip: await chip(3).innerText(), start: left.startTime },
    );
    await restored("a drop on an empty day");

    before = requestCount();
    await begin(rows, "Dogwood");
    await toChip(2);
    await sleep(1100);
    check(
      (await chip(2).getAttribute("aria-selected")) === "true",
      `holding a dragged stop over a day opens that day at ${tag}`,
    );
    const elm = await centre(row("Elm"));
    await go(elm.x, elm.box.y + elm.box.height * 0.25);
    check(
      (await line.count()) === 1 && (await line.first().boundingBox()).y <= elm.box.y + 4,
      `the insertion line shows above Elm in the opened day at ${tag}`,
      await line.count(),
    );
    await page.screenshot({ path: resolve(out, `dwell-${viewport.width}.png`), fullPage: true });
    await release();
    check(
      await waitDay("Dogwood", 2),
      `a drop inside an opened day moves the stop there at ${tag}`,
    );
    const placed = requests("move").at(-1)?.operation;
    check(
      requestCount() === before + 1 && placed?.day === 2 && placed?.index === 0,
      `the drop into an opened day is one move edit at the chosen position at ${tag}`,
      placed,
    );
    check(
      (await waitUntil(async () => (await shownNames()).join() === "Dogwood,Elm", 5000)) &&
        (await shownNumbers()).join() === "4,5",
      `the opened day shows the new order and numbers at ${tag}`,
      { names: await shownNames(), numbers: await shownNumbers() },
    );
    await restored("a drop inside an opened day");

    before = requestCount();
    await begin(rows, "Birch");
    const zone = await centre(ideasChip);
    await go(zone.x, zone.y);
    check(
      (await ideasChip.getAttribute("data-drop-target")) === "true",
      `the ideas chip is marked as the target while dragging a stop at ${tag}`,
    );
    await page.screenshot({ path: resolve(out, `to-ideas-${viewport.width}.png`), fullPage: true });
    await release();
    check(
      await waitUntil(async () => (await dayOf("Birch")) === undefined, 10_000),
      `a drop on Ideas unschedules the stop at ${tag}`,
    );
    const parked = await itemOf("Birch");
    check(
      requestCount() === before + 1 &&
        requests("idea").at(-1)?.operation.id === parked.id &&
        !parked.startTime &&
        !parked.endTime,
      `a drop on Ideas is one idea edit and clears the times at ${tag}`,
      { requests: requestCount() - before },
    );
    check(
      (await waitUntil(async () => (await ideasChip.innerText()) === "2 ideas", 5000)) &&
        (await shownNames()).join() === "Alder,Cedar,Dogwood" &&
        (await shownNumbers()).join() === "1,2,3",
      `the chip counts the stop and Day 1 renumbers at ${tag}`,
      { chip: await ideasChip.innerText(), day: await shownNames() },
    );
    await restored("a drop on Ideas");

    before = requestCount();
    await begin(rows, "Alder");
    await toChip(1);
    await release();
    await unchanged("a drop on the stop's own day chip", before);
    before = requestCount();
    await begin(rows, "Alder");
    await go(pos.x, phone ? pos.y : 5);
    await release();
    await unchanged("a release outside every day and the chip", before);
    if (phone) {
      await chip(1).click();
      const clipped = await page.evaluate(() => {
        const bounds = document.querySelector(".day-strip").getBoundingClientRect();
        const hidden = [...document.querySelectorAll(".day-strip__day")]
          .map((element) => element.getBoundingClientRect())
          .find((rect) => rect.right > bounds.right + 12 && bounds.right + 12 < innerWidth);
        if (!hidden) return null;
        return {
          x: (bounds.right + Math.min(hidden.right, innerWidth)) / 2,
          y: (hidden.top + hidden.bottom) / 2,
          hit: document
            .elementsFromPoint(
              (bounds.right + Math.min(hidden.right, innerWidth)) / 2,
              (hidden.top + hidden.bottom) / 2,
            )
            .some((element) => element.closest("[data-drop-zone]")),
        };
      });
      check(
        clipped !== null && !clipped.hit,
        `a Day chip clipped by the strip has a part beyond the strip with no chip showing at ${tag}`,
        clipped,
      );
      if (clipped) {
        before = requestCount();
        await begin(rows, "Alder");
        await go(clipped.x, clipped.y);
        await release();
        await unchanged("a release over the clipped part of a Day chip", before);
      }
    }

    if (!phone) {
      before = requestCount();
      await begin(rows, "Alder");
      await toChip(3);
      await sleep(1100);
      await page.keyboard.press("Escape");
      await release();
      await unchanged("Escape over a day chip", before);
      await chip(1).click();

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
      await begin(rows, "Alder");
      await toChip(3);
      const lockedMark = await chip(3).getAttribute("data-drop-target");
      await release();
      await unchanged("a drag while the assistant is running", before);
      check(!!held && lockedMark !== "true", "a running assistant disables the cross-day drag");
      await held?.abort();
      await page.unroute("**/api/chat");
    }

    check(pageErrors.length === 0, `no page errors at ${tag}`, pageErrors);
    await page.screenshot({ path: resolve(out, `final-${viewport.width}.png`), fullPage: true });
    await context.close();
  }
} catch (error) {
  check(false, "cross-day workflow completed without an exception", String(error));
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
