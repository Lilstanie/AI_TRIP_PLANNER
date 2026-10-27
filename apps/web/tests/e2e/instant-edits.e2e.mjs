import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor, waitUntil } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/instant-edits",
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
  for (const viewport of [
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

    const tripId = `instant-trip-${viewport.width}`;
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
              activity("idea", undefined, undefined, undefined, "Instant Idea"),
            ],
            assumptions: [],
            conflictsWith: [],
          },
        },
      ],
    };
    const conversationId = `instant-conversation-${viewport.width}`;
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
          title: "Sydney instant",
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
          title: "Sydney instant",
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

    const openTrip = async () => {
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
    };
    await openTrip();
    const timeline = page.getByRole("region", { name: "Trip timeline" });
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

    await showDay(1);
    const original = await savedCore();

    let before = await savedCore();
    const requestsBefore = editRequests.length;
    await page.getByRole("button", { name: "Add to Day 1", exact: true }).click();
    const panel = page.getByRole("region", { name: "Add to trip" });
    const search = panel.getByRole("searchbox", { name: "Search places" });
    await search.fill("Instant Cafe");
    await search.press("Enter");
    await panel.getByRole("button", { name: "Add Instant Cafe" }).click();
    await waitSaved((items) => items.some((item) => item.location === "Instant Cafe"));
    const cafe = await stored("Instant Cafe");
    check(
      cafe?.day === 1 && !!cafe.startTime && !!cafe.endTime && !!cafe.placeId,
      `choosing a search result puts the place on the viewed day at once at ${tag}`,
      cafe,
    );
    check(
      (await page.getByLabel("Start time").count()) === 0 &&
        (await page.getByRole("button", { name: "Add stop", exact: true }).count()) === 0 &&
        editRequests.slice(requestsBefore).filter((request) => request.operation.kind === "add")
          .length === 1,
      `no preview or confirm step follows a search result at ${tag}`,
    );
    check((await undoButton.count()) > 0, `adding a place offers Undo at ${tag}`);
    await undone("adding a searched place", before);

    await page.getByRole("button", { name: "Add to Day 1", exact: true }).click();
    await search.fill("Instant Museum");
    await search.press("Enter");
    await panel.getByRole("button", { name: "Add Instant Museum" }).click();
    await waitSaved(
      (items) => items.filter((item) => item.location === "Instant Museum").length === 2,
    );
    check(
      (await row("Instant Museum").count()) === 2,
      `a place already on the day is added again as its own stop at ${tag}`,
    );
    await undone("adding a place twice", before);

    await page.getByRole("button", { name: "Add to Day 1", exact: true }).click();
    await panel.getByRole("tab", { name: "Custom", exact: true }).click();
    await panel.getByRole("textbox", { name: "Name", exact: true }).fill("Meeting point");
    await panel.getByRole("button", { name: "Add", exact: true }).click();
    await waitSaved((items) => items.some((item) => item.location === "Meeting point"));
    const meeting = await stored("Meeting point");
    check(
      meeting?.day === 1 && !!meeting.startTime,
      `a custom name is added to the day at once at ${tag}`,
      meeting,
    );
    await undone("adding a custom place", before);
    await page.getByRole("button", { name: "Add to Ideas", exact: true }).click();
    await panel.getByRole("tab", { name: "Custom", exact: true }).click();
    await panel.getByRole("textbox", { name: "Name", exact: true }).fill("Parked place");
    await panel.getByRole("button", { name: "Add", exact: true }).click();
    await waitSaved((items) => items.some((item) => item.location === "Parked place"));
    check(
      (await stored("Parked place"))?.day === undefined,
      `a custom name can be saved as an Idea at once at ${tag}`,
    );
    await undone("saving an Idea", before);

    await page.getByRole("button", { name: "Add to Day 1", exact: true }).click();
    await search.fill("nothing here");
    await search.press("Enter");
    await page
      .getByRole("region", { name: "Add to trip" })
      .getByText("No places found. Try different words.")
      .waitFor();
    check(
      JSON.stringify(await savedCore()) === JSON.stringify(before),
      `a search with no results changes nothing at ${tag}`,
    );
    await search.press("Escape");
    check(
      await noDiscard(),
      `closing the Add to trip panel with text in it never asks to discard at ${tag}`,
    );

    await showDay(3);
    const lateBefore = await savedCore();
    await page.getByRole("button", { name: "Add to Day 3", exact: true }).click();
    await search.fill("Instant Night");
    await search.press("Enter");
    await panel.getByRole("button", { name: "Add Instant Night" }).click();
    await timeline.getByRole("alert").first().waitFor({ timeout: 8000 });
    check(
      JSON.stringify(await savedCore()) === JSON.stringify(lateBefore),
      `a day with no room refuses the add with a notice at ${tag}`,
    );
    await showDay(1);
    if (await panel.count())
      await panel.getByRole("button", { name: "Close", exact: true }).click();

    before = await savedCore();
    await row("Instant Museum").locator(".timeline-stop__time").click();
    const timeForm = page.locator(".stop-editor__time");
    await timeForm.getByLabel("Start", { exact: true }).fill("08:30");
    await timeForm.getByRole("button", { name: "Change time", exact: true }).click();
    await waitSaved(
      (items) =>
        items.find((item) => item.id === `museum-${viewport.width}`)?.startTime === "08:30",
    );
    check(await noDiscard(), `a time change lands without a confirm at ${tag}`);
    check((await undoButton.count()) > 0, `a time change offers Undo at ${tag}`);
    await undone("a time change", before);

    before = await savedCore();
    await menu("Instant Museum", "Edit details");
    await page.getByRole("textbox", { name: "What you will do", exact: true }).fill("Guided tour");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitSaved((items) => items.some((item) => item.detail === "Guided tour"));
    check((await undoButton.count()) > 0, `a details change offers Undo at ${tag}`);
    await undone("a details change", before);
    await menu("Instant Museum", "Add a comment");
    await page.getByRole("textbox", { name: "Comment", exact: true }).fill("Bring a hat");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitSaved((items) => items.some((item) => item.note === "Bring a hat"));
    await undone("a note change", before);

    await menu("Instant Garden", "Move to next day");
    await waitSaved(
      (items) => items.find((item) => item.id === `garden-${viewport.width}`)?.day === 2,
    );
    await undone("moving a stop to another day", before);
    if (!phone) {
      await row("Instant Garden").dragTo(row("Instant Museum"));
      await waitSaved(
        (items) =>
          items.find((item) => item.id === `garden-${viewport.width}`)?.startTime !== "11:00",
      );
      check(await noDiscard(), `a drop reorders the day without a confirm at ${tag}`);
      await undone("a drop", before);
    }

    await menu("Instant Garden", "Remove");
    await waitSaved((items) => !items.some((item) => item.location === "Instant Garden"));
    check(
      (await row("Instant Garden").count()) === 0 && (await undoButton.count()) > 0,
      `Remove takes effect at once with an Undo at ${tag}`,
    );
    await undone("removing a stop", before);

    await menu("Instant Garden", "Replace place");
    const replaceSearch = page.getByRole("searchbox").last();
    await replaceSearch.fill("Instant Pier");
    await replaceSearch.press("Enter");
    await page.getByRole("button", { name: "Use Instant Pier" }).click();
    await waitSaved((items) => items.some((item) => item.placeId === "stub:Instant Pier"));
    await undone("replacing a place", before);

    await menu("Instant Idea", "Schedule on a day");
    await page.getByLabel("Day", { exact: true }).selectOption("2");
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    await waitSaved(
      (items) => items.find((item) => item.id === `idea-${viewport.width}`)?.day === 2,
    );
    check(await noDiscard(), `scheduling an Idea lands without a confirm at ${tag}`);
    await undone("scheduling an Idea", before);

    await showDay(1);
    await row("Instant Museum").locator(".timeline-stop__time").click();
    await timeForm.getByLabel("Start", { exact: true }).fill("07:00");
    await timeForm.getByRole("button", { name: "Cancel", exact: true }).click();
    check(
      (await noDiscard()) && (await page.locator(".stop-editor__time").count()) === 0,
      `Cancel closes a half-filled time form without asking at ${tag}`,
    );
    await menu("Instant Museum", "Edit details");
    const details = page.getByRole("textbox", { name: "What you will do", exact: true });
    await details.fill("Never saved");
    await details.press("Escape");
    check(
      (await noDiscard()) && (await details.count()) === 0,
      `Escape closes a half-filled details form without asking at ${tag}`,
    );
    await menu("Instant Museum", "Add a comment");
    const note = page.getByRole("textbox", { name: "Comment", exact: true });
    await note.fill("Never saved");
    await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
    check(
      (await noDiscard()) && (await note.count()) === 0,
      `Cancel closes a half-filled note form without asking at ${tag}`,
    );
    await menu("Instant Idea", "Schedule on a day");
    await page.getByLabel("Day", { exact: true }).selectOption("3");
    await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
    check(await noDiscard(), `Cancel closes a half-filled schedule form without asking at ${tag}`);
    await menu("Instant Museum", "Replace place");
    const replace = page.getByRole("searchbox").last();
    await replace.fill("Never searched");
    await replace.press("Escape");
    check(await noDiscard(), `Escape closes a half-filled place search without asking at ${tag}`);
    await menu("Instant Museum", "Edit details");
    await page.getByRole("textbox", { name: "What you will do", exact: true }).fill("Left open");
    if (phone) await page.keyboard.press("Escape");
    else {
      await showDay(2);
      await showDay(1);
    }
    check(await noDiscard(), `leaving a half-filled form leaves no draft banner at ${tag}`);
    check(
      (await page.getByRole("textbox", { name: "What you will do", exact: true }).count()) === 0,
      `the abandoned details form is gone at ${tag}`,
    );
    check(
      JSON.stringify(await savedCore()) === JSON.stringify(original),
      `abandoned forms leave the saved plan unchanged at ${tag}`,
    );
    await page.screenshot({ path: resolve(out, `instant-${viewport.width}.png`), fullPage: true });

    await page.keyboard.press("Escape");
    if (phone) await page.getByRole("tab", { name: /^Chat/ }).click();
    else {
      const toggle = page.getByRole("button", { name: "Open your trip", exact: true });
      if ((await toggle.getAttribute("aria-expanded")) === "true") await toggle.click();
    }
    let held;
    await page.route("**/api/chat", (route) => {
      held = route;
    });
    const input = page.getByRole("textbox", { name: "Message AI Trip Planner", exact: true });
    await input.fill("Make day one lighter");
    await input.press("Enter");
    await waitUntil(() => !!held, 8000);
    if (phone) await page.getByRole("tab", { name: "Trip", exact: true }).click();
    else await page.getByRole("button", { name: "Open your trip", exact: true }).click();
    await timeline.waitFor();
    const lockedRequests = editRequests.length;
    const stop = row("Instant Museum").first();
    check(
      (await stop.locator(".timeline-stop__time").isDisabled()) &&
        (await page.getByRole("button", { name: "Add to Day 1", exact: true }).isDisabled()) &&
        (await stop.getAttribute("draggable")) !== "true",
      `a running assistant disables time, Add and drag at ${tag}`,
    );
    await stop.locator(".action-menu__trigger").click();
    const removeItem = page.getByRole("menuitem", { name: "Remove", exact: true });
    check(
      (await removeItem.getAttribute("aria-disabled")) === "true" ||
        (await removeItem.isDisabled()),
      `a running assistant disables stop menu items at ${tag}`,
    );
    await page.keyboard.press("Escape");
    if (!phone) await row("Instant Garden").dragTo(row("Instant Museum"), { force: true });
    check(
      editRequests.length === lockedRequests &&
        JSON.stringify(await savedCore()) === JSON.stringify(original),
      `no edit request is sent while the assistant runs at ${tag}`,
    );
    await held?.abort();
    await page.unroute("**/api/chat");
    const unlocked = await waitUntil(
      async () =>
        !(await row("Instant Museum").first().locator(".timeline-stop__time").isDisabled()),
      10_000,
    );
    check(unlocked, `edits work again once the assistant stops at ${tag}`);
    check(pageErrors.length === 0, `no page errors at ${tag}`, pageErrors);
    await page.screenshot({ path: resolve(out, `locked-${viewport.width}.png`), fullPage: true });
    await context.close();
  }
} catch (error) {
  check(false, "instant edit workflow completed without an exception", String(error));
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
