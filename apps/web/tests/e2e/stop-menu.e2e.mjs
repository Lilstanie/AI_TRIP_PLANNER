import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor, waitUntil } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/stop-menu",
  `${process.env.EVIDENCE_LABEL ?? "after"}${process.env.E2E_LANGUAGE === "zh" ? "-zh" : ""}`,
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const LANGUAGE = process.env.E2E_LANGUAGE ?? "en";
const zh = LANGUAGE === "zh";
const savedAt = "2026-10-27T00:00:00Z";
const BASE = process.env.BASE_URL ?? "http://localhost:3115";
const browser = await chromium.launch({ channel: process.env.CHANNEL });
let currentPage;

const core = (items) =>
  items
    .filter((item) => item.kind === "activity")
    .map(({ id, day, startTime, endTime, location, detail, note, placeId }) => ({
      id,
      day,
      startTime,
      endTime,
      location,
      detail,
      note,
      placeId,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

try {
  for (const viewport of LANGUAGE === "zh"
    ? [{ width: 1440, height: 900 }]
    : [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
      ]) {
    const phone = viewport.width <= 520;
    const tag = `${viewport.width}px`;
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
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
    await page.route("**/api/places/search", (route) => {
      const { text } = route.request().postDataJSON();
      return route.fulfill({
        json: { places: /nothing/i.test(text) ? [] : [placeFor(text)] },
      });
    });
    await page.route("**/api/trip/preview-edit", async (route) => {
      const body = route.request().postDataJSON();
      if (body.operation?.kind !== "place") return route.continue();
      const items = body.plan.sections.find((s) => s.id === "itinerary").proposal.items;
      const stop = items.find((item) => item.id === body.operation.id);
      const response = await route.fetch({
        postData: JSON.stringify({
          ...body,
          operation: {
            kind: "time",
            id: stop.id,
            startTime: stop.startTime,
            endTime: stop.endTime,
          },
        }),
      });
      const json = await response.json();
      const picked = json.plan?.sections
        .find((s) => s.id === "itinerary")
        .proposal.items.find((item) => item.id === body.operation.id);
      if (picked) picked.placeId = body.operation.placeId;
      await route.fulfill({ response, json });
    });

    const tripId = `menu-trip-${viewport.width}`;
    const activity = (id, day, startTime, endTime, name) => ({
      id: `${id}-${viewport.width}`,
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
              activity("museum", 1, "09:00", "10:00", "Instant Museum"),
              activity("garden", 1, "11:00", "12:00", "Instant Garden"),
              activity("harbour", 2, "11:00", "12:00", "Instant Harbour"),
              activity("late", 3, "22:00", "23:30", "Instant Late"),
              activity("last", 4, "09:00", "10:00", "Instant Last"),
              activity("idea", undefined, undefined, undefined, "Instant Idea"),
            ],
            assumptions: [],
            conflictsWith: [],
          },
        },
      ],
    };
    const conversationId = `menu-conversation-${viewport.width}`;
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
          title: "Sydney menu",
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
          title: "Sydney menu",
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
      ({ catalog, savedAt, LANGUAGE }) => {
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({
            version: 1,
            language: LANGUAGE,
            dataMode: "mock",
            travel: { homeCity: "", preferences: [] },
            appearance: "system",
            updatedAt: savedAt,
          }),
        );
      },
      { catalog, savedAt, LANGUAGE },
    );
    await page.goto(BASE);
    await page.locator(".workspace-app").waitFor();
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    const openTrip = async () => {
      if (phone) {
        await page.getByRole("tab", { name: "Mine", exact: true }).click();
        await page.locator(".phone-mine .trip-card").filter({ hasText: "Sydney" }).first().click();
        const tripTab = page.getByRole("tab", { name: "Trip", exact: true });
        if (await tripTab.count()) await tripTab.click();
      } else {
        await page.getByRole("button", { name: zh ? /^行程/ : /^Trips/ }).click();
        await page.locator(".trips-page .trip-card").filter({ hasText: "Sydney" }).first().click();
        const toggle = page.getByRole("button", {
          name: zh ? "打开你的行程" : "Open your trip",
          exact: true,
        });
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      }
    };
    await openTrip();
    const timeline = page.getByRole("region", { name: zh ? "行程时间线" : "Trip timeline" });
    await timeline.waitFor({ timeout: 8000 }).catch(() => undefined);
    if (!(await timeline.count())) {
      await page.screenshot({ path: resolve(out, `setup-${viewport.width}.png`), fullPage: true });
      check(false, `saved Trip fixture opens at ${tag}`, {
        body: (await page.locator("body").innerText()).slice(0, 800),
        errors: pageErrors,
      });
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
    const savedCore = async () => core(await saved());
    const waitSaved = (test) =>
      waitUntil(async () => {
        const items = await saved();
        return test(items);
      }, 10_000);
    const stored = async (name) =>
      (await saved()).find((item) => item.kind === "activity" && item.location === name);
    const showDay = async (day) => {
      if (zh) return;
      const tab = timeline.getByRole("tab", { name: new RegExp(`^Day ${day}\\b`) });
      if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
    };
    const row = (name) =>
      timeline.locator(".timeline-stop").filter({
        has: page.locator(".timeline-stop__name", { hasText: name }),
      });
    const menu = async (name, item) => {
      await row(name).first().locator(".action-menu__trigger").click();
      await page.getByRole("menuitem", { name: item, exact: true }).click();
    };
    const undoButton = page.getByRole("button", { name: /^Undo( last change)?$/ });
    const undo = async () => {
      await undoButton.first().click();
    };
    const noDiscard = async () =>
      (await page.getByRole("dialog", { name: "Discard changes?" }).count()) === 0 &&
      (await page.getByRole("button", { name: /Continue editing/ }).count()) === 0 &&
      (await page.getByLabel("Unfinished trip edits").count()) === 0;
    const undone = async (label, before) => {
      await undo();
      const restored = await waitUntil(
        async () => JSON.stringify(await savedCore()) === JSON.stringify(before),
        10_000,
      );
      check(restored, `Undo restores the saved plan after ${label} at ${tag}`);
    };

    const PRIMARY = [
      "Adjust schedule",
      "Edit details",
      "Add a comment",
      "Move to ideas",
      "Move to previous day",
      "Move to next day",
      "Add again",
      "Remove",
    ];
    const ZH = [
      "调整时间安排",
      "编辑详情",
      "添加评论",
      "移至备选地点",
      "移至前一天",
      "移至后一天",
      "再次添加",
      "移除",
    ];
    const itemsOf = async (name) => {
      await row(name).first().locator(".action-menu__trigger").click();
      const entries = await page.getByRole("menuitem").evaluateAll((nodes) =>
        nodes.map((node) => ({
          name: node.textContent.trim(),
          disabled: node.disabled || node.getAttribute("aria-disabled") === "true",
        })),
      );
      await page.keyboard.press("Escape");
      return entries;
    };
    const popover = (name) => timeline.getByRole("dialog", { name, exact: true });
    const sheetOpen = () =>
      page.locator(".fact-popover-scrim, .fact-popover--modal, .drawer--sheet").count();
    const unnamed = (scope) =>
      scope.locator("input, textarea, select, button").evaluateAll((nodes) =>
        nodes
          .filter((node) => {
            const labelled = [...(node.labels ?? [])].map((l) => l.textContent.trim()).join("");
            return !(
              node.getAttribute("aria-label") ||
              node.getAttribute("aria-labelledby") ||
              labelled ||
              node.textContent.trim()
            );
          })
          .map((node) => node.outerHTML.slice(0, 80)),
      );

    await showDay(1);
    const original = await savedCore();

    if (zh) {
      const names = (await itemsOf("Instant Museum")).map((entry) => entry.name);
      check(
        ZH.every((label) => names.includes(label)),
        `every stop menu item has a Chinese label`,
        names,
      );
      const idea = (await itemsOf("Instant Idea")).map((entry) => entry.name);
      check(
        ["安排到某一天", "编辑详情", "添加评论", "移除"].every((label) => idea.includes(label)),
        `every Idea menu item has a Chinese label`,
        idea,
      );
      await row("Instant Museum").first().locator(".action-menu__trigger").click();
      await page.getByRole("menuitem", { name: "调整时间安排", exact: true }).click();
      const zhPop = timeline.getByRole("dialog", { name: "调整时间安排", exact: true });
      await zhPop.waitFor({ timeout: 5000 }).catch(() => undefined);
      check(
        (await zhPop.count()) === 1 && (await unnamed(zhPop)).length === 0,
        `the schedule popover is named and its controls are labelled in Chinese`,
        await zhPop.innerText().catch(() => ""),
      );
      await page.keyboard.press("Escape");
      await context.close();
      continue;
    }

    const stopItems = await itemsOf("Instant Museum");
    const stopNames = stopItems.map((entry) => entry.name);
    const order = PRIMARY.map((label) => stopNames.indexOf(label));
    check(
      order.every(
        (position, index) => position >= 0 && (index === 0 || position > order[index - 1]),
      ),
      `the Stop menu lists the eight actions in order at ${tag}`,
      stopNames,
    );
    check(
      !stopNames.some((label) => /^Move (earlier|later)$|^Move to another day$/.test(label)),
      `Move earlier, Move later and Move to another day are gone at ${tag}`,
      stopNames,
    );
    check(
      stopNames.includes("Replace place") && stopNames.includes("Open in Maps"),
      `Replace place and Open in Maps stay as secondary items at ${tag}`,
      stopNames,
    );
    check(
      stopItems.find((entry) => entry.name === "Move to previous day")?.disabled === true &&
        stopItems.find((entry) => entry.name === "Move to next day")?.disabled === false,
      `Move to previous day is disabled on Day 1 at ${tag}`,
    );
    check(
      stopItems.every((entry) => entry.name.length > 0),
      `every Stop menu item has an accessible name at ${tag}`,
    );
    const ideaNames = (await itemsOf("Instant Idea")).map((entry) => entry.name);
    check(
      ["Schedule on a day", "Edit details", "Add a comment", "Remove"].every((label) =>
        ideaNames.includes(label),
      ) && !ideaNames.some((label) => /Move|Add again|Adjust/.test(label)),
      `an Idea menu offers Schedule on a day, Edit details, Add a comment and Remove at ${tag}`,
      ideaNames,
    );
    await showDay(4);
    const lastItems = await itemsOf("Instant Last");
    check(
      lastItems.find((entry) => entry.name === "Move to next day")?.disabled === true &&
        lastItems.find((entry) => entry.name === "Move to previous day")?.disabled === false,
      `Move to next day is disabled on the last day at ${tag}`,
    );
    await showDay(1);

    const fieldFor = (pop, label) =>
      label === "Start"
        ? pop.getByLabel(label, { exact: true })
        : pop.getByRole(label === "Day" ? "combobox" : "textbox", { name: label, exact: true });
    const viaMenu = async (name, item, dialog) => {
      await menu(name, item);
      await popover(dialog).waitFor({ timeout: 5000 });
      return popover(dialog);
    };
    const inPlace = async (pop, rowName) => {
      const box = await pop.boundingBox();
      const rowBox = await row(rowName).first().boundingBox();
      const view = page.viewportSize();
      return (
        !!box &&
        !!rowBox &&
        box.x >= -1 &&
        box.x + box.width <= view.width + 1 &&
        box.y >= rowBox.y - 4 &&
        box.y <= rowBox.y + rowBox.height + 120 &&
        (await row(rowName).first().locator(".stop-popover").count()) === 1 &&
        (await sheetOpen()) === 0
      );
    };

    let before = await savedCore();
    let pop = await viaMenu("Instant Museum", "Adjust schedule", "Adjust schedule");
    check(
      await inPlace(pop, "Instant Museum"),
      `Adjust schedule opens a popover on the row at ${tag}`,
    );
    check(
      (await unnamed(pop)).length === 0,
      `every Adjust schedule control has an accessible name at ${tag}`,
      await unnamed(pop),
    );
    await fieldFor(pop, "Start").fill("08:30");
    await pop.getByRole("button", { name: "Change time", exact: true }).click();
    await waitSaved(
      (items) =>
        items.find((item) => item.id === `museum-${viewport.width}`)?.startTime === "08:30",
    );
    check(
      (await popover("Adjust schedule").count()) === 0 && (await undoButton.count()) > 0,
      `Adjust schedule takes effect at once with an Undo at ${tag}`,
    );
    await undone("Adjust schedule", before);

    await row("Instant Museum").locator(".timeline-stop__time").click();
    pop = popover("Adjust schedule");
    await pop.waitFor({ timeout: 5000 });
    check(
      await inPlace(pop, "Instant Museum"),
      `tapping the time opens the same popover on the row at ${tag}`,
    );
    await page.keyboard.press("Escape");
    check(
      (await popover("Adjust schedule").count()) === 0 &&
        JSON.stringify(await savedCore()) === JSON.stringify(original),
      `Escape closes the time popover and saves nothing at ${tag}`,
    );

    await row("Instant Museum").locator(".timeline-stop__time").click();
    await popover("Adjust schedule").waitFor();
    await fieldFor(popover("Adjust schedule"), "Start").fill("07:00");
    await page.locator(".workspace-app").click({ position: { x: 4, y: 4 }, force: true });
    check(
      (await popover("Adjust schedule").count()) === 0 &&
        JSON.stringify(await savedCore()) === JSON.stringify(original),
      `an outside tap closes the popover and saves nothing at ${tag}`,
    );

    pop = await viaMenu("Instant Museum", "Edit details", "Edit details");
    check(
      await inPlace(pop, "Instant Museum"),
      `Edit details opens a popover on the row at ${tag}`,
    );
    check(
      (await unnamed(pop)).length === 0,
      `every Edit details control has an accessible name at ${tag}`,
      await unnamed(pop),
    );
    await fieldFor(pop, "What you will do").fill("Guided tour");
    await fieldFor(pop, "Place name").fill("Instant Museum");
    await pop.getByRole("button", { name: "Save", exact: true }).click();
    await waitSaved((items) => items.some((item) => item.detail === "Guided tour"));
    check((await undoButton.count()) > 0, `Edit details takes effect with an Undo at ${tag}`);
    await undone("Edit details", before);

    pop = await viaMenu("Instant Museum", "Add a comment", "Add a comment");
    check(
      await inPlace(pop, "Instant Museum"),
      `Add a comment opens a popover on the row at ${tag}`,
    );
    check(
      (await unnamed(pop)).length === 0,
      `every Add a comment control has an accessible name at ${tag}`,
      await unnamed(pop),
    );
    await fieldFor(pop, "Comment").fill("Bring a hat");
    await pop.getByRole("button", { name: "Save", exact: true }).click();
    await waitSaved((items) => items.some((item) => item.note === "Bring a hat"));
    check((await undoButton.count()) > 0, `Add a comment takes effect with an Undo at ${tag}`);
    await undone("Add a comment", before);

    await menu("Instant Garden", "Move to ideas");
    await waitSaved(
      (items) => items.find((item) => item.id === `garden-${viewport.width}`)?.day === undefined,
    );
    check((await undoButton.count()) > 0, `Move to ideas takes effect with an Undo at ${tag}`);
    await undone("Move to ideas", before);

    await menu("Instant Garden", "Move to next day");
    await waitSaved(
      (items) => items.find((item) => item.id === `garden-${viewport.width}`)?.day === 2,
    );
    check(
      (await row("Instant Garden").count()) === 0,
      `Move to next day takes the stop off this day at once at ${tag}`,
    );
    await undone("Move to next day", before);

    await showDay(2);
    await menu("Instant Harbour", "Move to previous day");
    await waitSaved(
      (items) => items.find((item) => item.id === `harbour-${viewport.width}`)?.day === 1,
    );
    await undone("Move to previous day", before);

    await menu("Instant Harbour", "Move to next day");
    await timeline.getByRole("alert").first().waitFor({ timeout: 8000 });
    check(
      JSON.stringify(await savedCore()) === JSON.stringify(before),
      `Move to next day into a day with no room refuses with a notice and changes nothing at ${tag}`,
    );
    await showDay(1);

    await menu("Instant Museum", "Add again");
    await waitSaved(
      (items) => items.filter((item) => item.location === "Instant Museum").length === 2,
    );
    check(
      (await row("Instant Museum").count()) === 2 && (await undoButton.count()) > 0,
      `Add again puts the place on the day a second time with an Undo at ${tag}`,
    );
    await undone("Add again", before);

    await menu("Instant Garden", "Remove");
    await waitSaved((items) => !items.some((item) => item.location === "Instant Garden"));
    check(
      (await row("Instant Garden").count()) === 0 && (await undoButton.count()) > 0,
      `Remove takes effect at once with an Undo at ${tag}`,
    );
    await undone("Remove", before);

    pop = await viaMenu("Instant Idea", "Schedule on a day", "Schedule on a day");
    check(
      await inPlace(pop, "Instant Idea"),
      `Schedule on a day opens a popover on the row at ${tag}`,
    );
    check(
      (await unnamed(pop)).length === 0,
      `every Schedule on a day control has an accessible name at ${tag}`,
      await unnamed(pop),
    );
    await fieldFor(pop, "Day").selectOption("2");
    await pop.getByRole("button", { name: "Schedule", exact: true }).click();
    await waitSaved(
      (items) => items.find((item) => item.id === `idea-${viewport.width}`)?.day === 2,
    );
    await undone("Schedule on a day", before);

    pop = await viaMenu("Instant Idea", "Edit details", "Edit details");
    await fieldFor(pop, "What you will do").fill("Park picnic");
    await pop.getByRole("button", { name: "Save", exact: true }).click();
    await waitSaved((items) => items.some((item) => item.detail === "Park picnic"));
    await undone("Edit details on an Idea", before);

    pop = await viaMenu("Instant Idea", "Add a comment", "Add a comment");
    await fieldFor(pop, "Comment").fill("Ask Sam");
    await pop.getByRole("button", { name: "Save", exact: true }).click();
    await waitSaved((items) => items.some((item) => item.note === "Ask Sam"));
    await undone("Add a comment on an Idea", before);

    await menu("Instant Idea", "Remove");
    await waitSaved((items) => !items.some((item) => item.location === "Instant Idea"));
    await undone("Remove on an Idea", before);

    const trigger = row("Instant Museum").first().locator(".action-menu__trigger");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Adjust schedule", exact: true }).waitFor();
    await page.keyboard.press("Enter");
    await popover("Adjust schedule").waitFor({ timeout: 5000 });
    const focusedInside = await page.evaluate(
      () => !!document.activeElement?.closest(".stop-popover"),
    );
    check(focusedInside, `the keyboard opens a popover and moves focus into it at ${tag}`);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    check(
      await page.evaluate(() => !!document.activeElement?.closest(".stop-popover")),
      `Tab reaches the popover controls at ${tag}`,
    );
    await page.keyboard.press("Escape");
    check(
      (await popover("Adjust schedule").count()) === 0 &&
        (await page.evaluate(() => !!document.activeElement?.closest(".timeline-stop"))),
      `Escape closes the popover and returns focus to the row at ${tag}`,
    );

    await row("Instant Museum").locator(".timeline-stop__main").click();
    check(
      (await row("Instant Museum").locator(".stop-place-card").count()) === 1 &&
        (await popover("Adjust schedule").count()) === 0,
      `tapping the row opens place details at ${tag}`,
    );
    await row("Instant Museum").locator(".timeline-stop__main").click();

    check(
      JSON.stringify(await savedCore()) === JSON.stringify(original),
      `every menu action was undone and the saved plan is the original at ${tag}`,
    );
    await page.screenshot({ path: resolve(out, `menu-${viewport.width}.png`), fullPage: true });
    await row("Instant Museum").first().locator(".action-menu__trigger").click();
    await page.screenshot({
      path: resolve(out, `menu-open-${viewport.width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    check(pageErrors.length === 0, `no page errors at ${tag}`, pageErrors);
    await context.close();
  }
} catch (error) {
  check(false, "stop menu workflow completed without an exception", String(error));
  if (currentPage) {
    await currentPage
      .screenshot({ path: resolve(out, "exception.png"), fullPage: true })
      .catch(() => undefined);
  }
} finally {
  await browser.close();
  const passed = checks.length > 0 && checks.every((item) => item.ok);
  writeFileSync(resolve(out, "result.json"), JSON.stringify({ passed, checks }, null, 2));
  if (!passed) process.exitCode = 1;
}
