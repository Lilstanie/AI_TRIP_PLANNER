import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor, sleep, waitUntil } from "./trip-setup.mjs";
import { openTripWorkspace } from "./support/e2e-helpers.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/drag-in-day",
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

    const tripId = `drag-trip-${viewport.width}`;
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
              activity("Fir", undefined, undefined, undefined),
            ],
            assumptions: [],
            conflictsWith: [],
          },
        },
      ],
    };
    const conversationId = `drag-conversation-${viewport.width}`;
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
          title: "Sydney drag",
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
          title: "Sydney drag",
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
      await openTripWorkspace(
        page,
        page.locator(".phone-mine .trip-card").filter({ hasText: "Sydney" }).first(),
      );
      const tripTab = page.getByRole("tab", { name: "Trip", exact: true });
      if (await tripTab.count()) await tripTab.click();
    } else {
      await page.getByRole("button", { name: /^Trips/ }).click();
      await openTripWorkspace(
        page,
        page.locator(".trips-page .trip-card").filter({ hasText: "Sydney" }).first(),
      );
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
    const savedOrder = async () => orderOf(await saved(), 1);
    const waitOrder = (expected) =>
      waitUntil(async () => (await savedOrder()).join() === expected.join(), 10_000);
    const dayPanel = timeline.locator(".timeline-day");
    const rows = dayPanel.locator(".timeline-stop");
    const row = (name) =>
      rows.filter({ has: page.locator(".timeline-stop__name", { hasText: name }) }).first();
    const shownNames = async () =>
      (await rows.locator(".timeline-stop__name").allTextContents()).map((text) =>
        text.replace(/^Stop \d+:\s*/, "").trim(),
      );
    const shownNumbers = async () =>
      (await rows.locator(".timeline-stop__node").allTextContents()).map((text) => text.trim());
    const shownTimes = async () =>
      (await rows.locator(".timeline-stop__time").allTextContents()).map((text) =>
        text.trim().slice(0, 5),
      );
    const directionLinks = async () =>
      dayPanel
        .locator("a.timeline-connection__directions")
        .evaluateAll((links) => links.map((link) => link.getAttribute("aria-label")));
    const line = dayPanel.locator(".timeline-drop-line");
    const undoButton = page.getByRole("button", { name: /^Undo( last change)?$/ });
    const edits = () => editRequests.filter((request) => request.operation.kind === "move");
    const box = async (name) => {
      await row(name).scrollIntoViewIfNeeded();
      return row(name).boundingBox();
    };
    const scrollTopOf = () =>
      row("Alder").evaluate((el) => {
        for (let n = el.parentElement; n; n = n.parentElement) {
          const o = getComputedStyle(n).overflowY;
          if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight)
            return n.scrollTop;
        }
        return document.scrollingElement.scrollTop;
      });
    const frameRows = async (from, to) => {
      await row(from).scrollIntoViewIfNeeded();
      await row(to).scrollIntoViewIfNeeded();
      const a = await row(from).boundingBox();
      const b = await row(to).boundingBox();
      const dy = (a.y + a.height / 2 + b.y + b.height / 2) / 2 - viewport.height / 2;
      await row(from).evaluate((el, delta) => {
        for (let n = el.parentElement; n; n = n.parentElement) {
          const o = getComputedStyle(n).overflowY;
          if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) {
            n.scrollTop += delta;
            return;
          }
        }
        document.scrollingElement.scrollTop += delta;
      }, dy);
    };
    const point = (b, fraction) => ({ x: b.x + b.width * 0.5, y: b.y + b.height * fraction });

    const mouseDrag = async (from, target, release = true, via = ".timeline-stop__name") => {
      const handle = await row(from).locator(via).first().boundingBox();
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
      await page.mouse.down();
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 12);
      await page.mouse.move(target.x, target.y, { steps: 8 });
      if (release) await page.mouse.up();
    };

    const touchSend = (type, x, y) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
      });
    const cdp = phone ? await context.newCDPSession(page) : undefined;
    const touchDrag = async (from, target, { hold, release = true }) => {
      await row(from).scrollIntoViewIfNeeded();
      const handle = await row(from).locator(".timeline-stop__name").first().boundingBox();
      const x = handle.x + handle.width / 2;
      const y = handle.y + handle.height / 2;
      await touchSend("touchStart", x, y);
      await sleep(hold);
      const steps = 8;
      for (let step = 1; step <= steps; step += 1)
        await touchSend(
          "touchMove",
          x + ((target.x - x) * step) / steps,
          y + ((target.y - y) * step) / steps,
        );
      if (release) await touchSend("touchEnd", 0, 0);
    };

    const original = await saved();
    const baseline = core(original);
    check(
      (await savedOrder()).join() === NAMES.join() && (await shownNames()).join() === NAMES.join(),
      `the fixture day lists four stops in order at ${tag}`,
      await shownNames(),
    );
    check(
      (await shownNumbers()).join() === "1,2,3,4",
      `the fixture stops are numbered 1 to 4 at ${tag}`,
      await shownNumbers(),
    );
    check(
      (await row("Alder").locator(".timeline-stop__main").getAttribute("aria-keyshortcuts")) !==
        null,
      `a stop names its keyboard shortcut for reordering at ${tag}`,
    );

    const target = async (name, fraction) => point(await box(name), fraction);
    const reorder = async (label, from, to, fraction, expected, how) => {
      const requestsBefore = edits().length;
      const lineSeen = { count: 0, y: 0 };
      await frameRows(from, to);
      if (phone) {
        const goal = await target(to, fraction);
        await touchDrag(from, goal, { hold: 700, release: false });
      } else {
        await mouseDrag(from, await target(to, fraction), false, how);
      }
      lineSeen.count = await line.count();
      lineSeen.y = lineSeen.count ? (await line.first().boundingBox()).y : 0;
      const toBox = await box(to);
      check(
        lineSeen.count === 1,
        `one insertion line shows while dragging ${label} at ${tag}`,
        lineSeen.count,
      );
      check(
        fraction < 0.5
          ? lineSeen.y <= toBox.y + toBox.height / 2 && lineSeen.y >= toBox.y - toBox.height
          : lineSeen.y >= toBox.y + toBox.height / 2 && lineSeen.y <= toBox.y + toBox.height * 2,
        `the insertion line sits ${fraction < 0.5 ? "before" : "after"} ${to} at ${tag}`,
        { line: lineSeen.y, row: toBox },
      );
      await page.screenshot({
        path: resolve(out, `dragging-${label.replaceAll(" ", "-")}-${viewport.width}.png`),
        fullPage: true,
      });
      if (phone) await touchSend("touchEnd", 0, 0);
      else await page.mouse.up();
      check(await waitOrder(expected), `${label} reorders the saved day at ${tag}`, {
        saved: await savedOrder(),
      });
      check(
        (await waitUntil(async () => (await shownNames()).join() === expected.join(), 5000)) &&
          (await shownNumbers()).join() === "1,2,3,4" &&
          (await line.count()) === 0,
        `the list, the numbers and the cleared line follow ${label} at ${tag}`,
        { names: await shownNames(), numbers: await shownNumbers() },
      );
      check(
        edits().length === requestsBefore + 1,
        `${label} is one edit at ${tag}`,
        edits().length - requestsBefore,
      );
      return expected;
    };
    const undoTo = async (label) => {
      await undoButton.first().click();
      const restored = await waitUntil(
        async () => JSON.stringify(core(await saved())) === JSON.stringify(baseline),
        10_000,
      );
      check(restored, `Undo restores the saved plan after ${label} at ${tag}`);
      check(
        (await shownNames()).join() === NAMES.join() &&
          (await shownTimes()).join() === "09:00,11:00,13:00,15:00",
        `Undo restores the order and times shown after ${label} at ${tag}`,
        { names: await shownNames(), times: await shownTimes() },
      );
    };

    await reorder("a drop between two stops", "Dogwood", "Birch", 0.25, [
      "Alder",
      "Dogwood",
      "Birch",
      "Cedar",
    ]);
    const links = await directionLinks();
    check(
      links.length === 0 || (links[0].includes("Alder") && links[0].includes("Dogwood")),
      `the Directions links follow the new order at ${tag}`,
      links,
    );
    await undoTo("a drop between two stops");

    await reorder(
      "a drop on the last position",
      phone ? "Cedar" : "Alder",
      "Dogwood",
      0.75,
      phone ? ["Alder", "Birch", "Dogwood", "Cedar"] : ["Birch", "Cedar", "Dogwood", "Alder"],
    );
    await undoTo("a drop on the last position");

    await reorder("a drop on the first position", "Cedar", "Alder", 0.25, [
      "Cedar",
      "Alder",
      "Birch",
      "Dogwood",
    ]);
    await undoTo("a drop on the first position");

    if (!phone) {
      await reorder(
        "a drag from the time button",
        "Cedar",
        "Alder",
        0.25,
        ["Cedar", "Alder", "Birch", "Dogwood"],
        ".timeline-stop__time",
      );
      check(
        (await page.getByRole("textbox", { name: /start/i }).count()) === 0,
        "releasing a drag from the time button does not open the time form",
      );
      await undoTo("a drag from the time button");
      await reorder(
        "a drag from the cost",
        "Birch",
        "Dogwood",
        0.75,
        ["Alder", "Cedar", "Dogwood", "Birch"],
        ".timeline-row__cost",
      );
      await undoTo("a drag from the cost");
      await reorder(
        "a drag from the menu button",
        "Alder",
        "Cedar",
        0.75,
        ["Birch", "Cedar", "Alder", "Dogwood"],
        ".action-menu__trigger",
      );
      check(
        (await page.getByRole("menu").count()) === 0,
        "releasing a drag from the menu button does not open the menu",
      );
      await undoTo("a drag from the menu button");
    }

    const requestsBefore = edits().length;
    const savedBefore = JSON.stringify(core(await saved()));
    const noChange = async (label) => {
      await sleep(400);
      check(
        edits().length === requestsBefore &&
          JSON.stringify(core(await saved())) === savedBefore &&
          (await line.count()) === 0 &&
          (await shownNames()).join() === NAMES.join(),
        `${label} changes nothing and leaves no line at ${tag}`,
      );
    };

    if (phone) {
      await page.evaluate(() => {
        window.__cancels = 0;
        window.addEventListener("pointercancel", () => (window.__cancels += 1), true);
      });
      await row("Birch").scrollIntoViewIfNeeded();
      const topBefore = await scrollTopOf();
      const held = await row("Birch").locator(".timeline-stop__name").boundingBox();
      await touchSend("touchStart", held.x + 20, held.y + held.height / 2);
      await sleep(700);
      for (let step = 1; step <= 8; step += 1)
        await touchSend("touchMove", held.x + 20, held.y + held.height / 2 + step * 12);
      await sleep(200);
      const holding = {
        line: await line.count(),
        top: [topBefore, await scrollTopOf()],
        cancels: await page.evaluate(() => window.__cancels),
      };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      await sleep(300);
      check(
        holding.line === 1 && holding.top[0] === holding.top[1] && holding.cancels === 0,
        `a held touch drag moves the stop without panning the page or being cancelled at ${tag}`,
        holding,
      );
      await noChange("a held touch drag cancelled in the middle of the list");
    }
    if (phone) {
      await row("Alder").scrollIntoViewIfNeeded();
      const topBefore = await scrollTopOf();
      const start = await row("Alder").locator(".timeline-stop__name").boundingBox();
      await touchSend("touchStart", start.x + 20, start.y + start.height / 2);
      await sleep(700);
      for (let step = 1; step <= 6; step += 1)
        await touchSend(
          "touchMove",
          start.x + 20,
          start.y + ((viewport.height - 110 - start.y) * step) / 6,
        );
      await sleep(900);
      const topAfter = await scrollTopOf();
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      await sleep(300);
      check(topAfter > topBefore + 40, `dragging near the bottom edge scrolls the list at ${tag}`, {
        topBefore,
        topAfter,
      });
      await noChange("a cancelled touch drag");
      await row("Birch").scrollIntoViewIfNeeded();
      const handle = await row("Birch").locator(".timeline-stop__name").boundingBox();
      await touchSend("touchStart", handle.x + 20, handle.y + handle.height / 2);
      await touchSend("touchMove", handle.x + 20, handle.y + handle.height / 2 - 60);
      await touchSend("touchMove", handle.x + 20, handle.y + handle.height / 2 - 120);
      await sleep(100);
      const swiping = await line.count();
      await touchSend("touchEnd", 0, 0);
      check(swiping === 0, `a quick swipe scrolls instead of dragging at ${tag}`);
      await noChange("a swipe");
      await row("Cedar").scrollIntoViewIfNeeded();
      const cedar = await row("Cedar").locator(".timeline-stop__name").boundingBox();
      await touchSend("touchStart", cedar.x + 20, cedar.y + cedar.height / 2);
      await sleep(700);
      await touchSend("touchEnd", 0, 0);
      await sleep(300);
      check(
        (await row("Cedar").locator(".timeline-stop__main").getAttribute("aria-expanded")) !==
          "true",
        `a long press released in place is not a drop at ${tag}`,
      );
      await noChange("a long press released in place");
    } else {
      const self = await box("Birch");
      await mouseDrag("Birch", point(self, 0.4));
      await noChange("dropping a stop on itself");
      const near = await box("Cedar");
      await mouseDrag("Birch", point(near, 0.25));
      await noChange("dropping a stop in the gap right above itself");

      const strip = await timeline.locator(".timeline-day__title").boundingBox();
      await mouseDrag("Birch", point(strip, 0.5));
      await noChange("releasing outside the day list");

      await mouseDrag("Birch", await target("Dogwood", 0.75), false);
      check((await line.count()) === 1, "a line shows before Escape");
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await noChange("Escape during a drag");

      await mouseDrag("Birch", point(await box("Birch"), 0.5));
      check(
        (await row("Birch").locator(".timeline-stop__main").getAttribute("aria-expanded")) !==
          "true",
        "a drag released over its own row does not open the place details",
      );
      await row("Birch").locator(".timeline-stop__name").click();
      check(
        (await row("Birch").locator(".timeline-stop__main").getAttribute("aria-expanded")) ===
          "true",
        "a plain click still opens the place details",
      );
      await row("Birch").locator(".timeline-stop__name").click();
      await row("Birch").locator(".action-menu__trigger").click();
      await page.getByRole("menuitem", { name: "Edit details", exact: true }).click();
      const field = page.getByRole("textbox", { name: "What you will do", exact: true });
      await field.fill("Select this text");
      const fieldBox = await field.boundingBox();
      await page.mouse.move(fieldBox.x + 10, fieldBox.y + fieldBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(fieldBox.x + 60, fieldBox.y + fieldBox.height / 2 + 4, { steps: 4 });
      check((await line.count()) === 0, "pressing inside an open editor field does not drag");
      await page.mouse.up();
      await page.keyboard.press("Escape");
      await sleep(200);
    }

    const main = row("Cedar").locator(".timeline-stop__main");
    const keyboardBefore = edits().length;
    await main.focus();
    await page.keyboard.press("Alt+ArrowUp");
    check(
      await waitOrder(["Alder", "Cedar", "Birch", "Dogwood"]),
      `Alt+ArrowUp moves the focused stop up one place at ${tag}`,
      await savedOrder(),
    );
    const status = page.getByRole("status").filter({ hasText: /moved to position 2 of 4/ });
    check(
      (await waitUntil(async () => (await status.count()) > 0, 5000)) &&
        /Cedar/.test(await status.first().innerText()),
      `the keyboard move is announced with the new position at ${tag}`,
      await page.getByRole("status").allInnerTexts(),
    );
    check(
      await waitUntil(
        async () =>
          await row("Cedar")
            .locator(".timeline-stop__main")
            .evaluate((node) => node === document.activeElement),
        3000,
      ),
      `focus stays on the moved stop at ${tag}`,
    );
    check((await undoButton.count()) > 0, `the keyboard move offers Undo at ${tag}`);
    await undoTo("a keyboard move");
    await row("Dogwood").locator(".timeline-stop__main").focus();
    await page.keyboard.press("Alt+ArrowDown");
    await row("Alder").locator(".timeline-stop__main").focus();
    await page.keyboard.press("Alt+ArrowUp");
    await sleep(500);
    check(
      edits().length === keyboardBefore + 1,
      `Alt+ArrowUp on the first stop and Alt+ArrowDown on the last send no edit at ${tag}`,
      edits().length - keyboardBefore,
    );
    await page.screenshot({ path: resolve(out, `keyboard-${viewport.width}.png`), fullPage: true });

    if (!phone) {
      const midBefore = edits().length;
      await mouseDrag("Birch", await target("Dogwood", 0.75), false);
      const midLine = await line.count();
      await row("Cedar").locator(".timeline-stop__main").focus();
      await page.keyboard.press("Alt+ArrowUp");
      check(
        await waitUntil(() => edits().length === midBefore + 1, 5000),
        "an edit starting during a drag is sent",
      );
      const cancelled = await waitUntil(async () => (await line.count()) === 0, 5000);
      await page.mouse.up();
      await sleep(600);
      check(midLine === 1, "a line showed while the drag was under way");
      check(
        cancelled &&
          edits().length === midBefore + 1 &&
          (await savedOrder()).join() === ["Alder", "Cedar", "Birch", "Dogwood"].join(),
        "a drop released while another edit ran sends no second edit and leaves no line",
        { requests: edits().length - midBefore, saved: await savedOrder() },
      );
      await undoTo("an edit during a drag");

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
      const lockedBefore = edits().length;
      await mouseDrag("Birch", await target("Dogwood", 0.75), false);
      const lockedLine = await line.count();
      await page.mouse.up();
      await sleep(500);
      check(
        !!held &&
          lockedLine === 0 &&
          edits().length === lockedBefore &&
          (await savedOrder()).join() === NAMES.join(),
        "a running assistant disables the drag: no line and no edit",
        { held: !!held, line: lockedLine },
      );
      await page.screenshot({ path: resolve(out, `locked-${viewport.width}.png`), fullPage: true });
      await held?.abort();
      await page.unroute("**/api/chat");
      const unlocked = await waitUntil(
        async () => !(await row("Birch").locator(".timeline-stop__time").isDisabled()),
        10_000,
      );
      check(unlocked, "edits work again once the assistant stops");
    }

    check(pageErrors.length === 0, `no page errors at ${tag}`, pageErrors);
    await page.screenshot({ path: resolve(out, `final-${viewport.width}.png`), fullPage: true });
    await context.close();
  }
} catch (error) {
  check(false, "drag workflow completed without an exception", String(error));
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
