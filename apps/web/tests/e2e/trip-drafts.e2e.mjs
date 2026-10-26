import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/trip-drafts",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const savedAt = "2026-10-26T00:00:00Z";
const browser = await chromium.launch({ channel: process.env.CHANNEL });
let currentPage;

try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 521, height: 844 },
    { width: 520, height: 844 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    currentPage = page;
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    const first = placeFor("Draft Museum");
    const second = placeFor("Draft Garden");
    await page.route("**/api/places/details", (route) => {
      const { placeId } = route.request().postDataJSON();
      return route.fulfill({ json: { place: placeId === first.id ? first : second } });
    });
    await page.route("**/api/places/search", (route) =>
      route.fulfill({ json: { places: [second] } }),
    );
    let failNextPlaceSave = true;
    await page.route("**/api/trip/preview-edit", (route) => {
      if (failNextPlaceSave) {
        failNextPlaceSave = false;
        return route.fulfill({ status: 503, json: { error: "Draft fixture save failure" } });
      }
      return route.continue();
    });
    const tripId = `draft-trip-${viewport.width}`;
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
              {
                id: `draft-day-one-${viewport.width}`,
                kind: "activity",
                day: 1,
                startTime: "09:00",
                endTime: "10:00",
                location: first.displayName.text,
                detail: first.displayName.text,
                placeId: first.id,
              },
              {
                id: `draft-day-two-${viewport.width}`,
                kind: "activity",
                day: 2,
                startTime: "11:00",
                endTime: "12:00",
                location: second.displayName.text,
                detail: second.displayName.text,
                placeId: second.id,
              },
            ],
            assumptions: [],
            conflictsWith: [],
          },
        },
      ],
    };
    const conversationId = `draft-conversation-${viewport.width}`;
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
    const otherTripId = `draft-trip-alternate-${viewport.width}`;
    const otherConversationId = `draft-conversation-alternate-${viewport.width}`;
    const otherPlan = structuredClone(plan);
    otherPlan.tripId = otherTripId;
    otherPlan.brief.tripId = otherTripId;
    otherPlan.brief.destination = "Melbourne";
    otherPlan.sections[0].proposal.items.forEach((item) => {
      item.id = `${item.id}-alternate`;
    });
    const otherSnapshot = { ...snapshot, id: otherConversationId, plan: otherPlan };
    const catalog = {
      version: 4,
      activeConversationId: conversationId,
      activeTripId: tripId,
      conversations: [
        {
          id: conversationId,
          title: "Sydney draft",
          updatedAt: savedAt,
          tripId,
          messages: [],
          input: "",
          snapshot,
        },
        {
          id: otherConversationId,
          title: "Melbourne draft",
          updatedAt: savedAt,
          tripId: otherTripId,
          messages: [],
          input: "",
          snapshot: otherSnapshot,
        },
      ],
      trips: [
        {
          id: tripId,
          title: "Sydney draft",
          status: "draft",
          updatedAt: savedAt,
          conversationIds: [conversationId],
          snapshot,
        },
        {
          id: otherTripId,
          title: "Melbourne draft",
          status: "draft",
          updatedAt: savedAt,
          conversationIds: [otherConversationId],
          snapshot: otherSnapshot,
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
      ({ catalog }) => {
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({
            version: 1,
            language: "en",
            dataMode: "mock",
            travel: { homeCity: "", preferences: [] },
            appearance: "system",
            updatedAt: "2026-10-26T00:00:00Z",
          }),
        );
      },
      { catalog },
    );
    await page.goto(process.env.BASE_URL ?? "http://localhost:3115");
    await page.locator(".workspace-app").waitFor();
    const selectSavedTrip = async (title) => {
      const destination = title.startsWith("Melbourne") ? "Melbourne" : "Sydney";
      if (viewport.width <= 520) {
        await page.getByRole("tab", { name: "Mine", exact: true }).click();
        await page
          .locator(".phone-mine .trip-card")
          .filter({ hasText: destination })
          .first()
          .click();
        const tripTab = page.getByRole("tab", { name: "Trip", exact: true });
        if (await tripTab.count()) await tripTab.click();
      } else {
        if (viewport.width <= 900) {
          await page.getByRole("button", { name: "Open navigation", exact: true }).click();
        }
        await page.getByRole("button", { name: /^Trips/ }).click();
        await page
          .locator(".trips-page .trip-card")
          .filter({ hasText: destination })
          .first()
          .click();
        const openTrip = page.getByRole("button", { name: "Open your trip", exact: true });
        if ((await openTrip.getAttribute("aria-expanded")) !== "true") await openTrip.click();
      }
    };
    if (viewport.width <= 520) {
      await selectSavedTrip("Sydney draft");
    } else {
      await selectSavedTrip("Sydney draft");
    }
    const timeline = page.getByRole("region", { name: "Trip timeline" });
    await timeline.waitFor({ timeout: 5000 }).catch(() => undefined);
    if (!(await timeline.count())) {
      await page.screenshot({ path: resolve(out, `setup-${viewport.width}.png`), fullPage: true });
      check(false, `saved Trip fixture opens at ${viewport.width}px`, {
        body: (await page.locator("body").innerText()).slice(0, 1200),
        errors: pageErrors,
      });
      await context.close();
      continue;
    }
    if (viewport.width > 520) {
      const dayOne = timeline.getByRole("tab").filter({ hasText: /^Day 1/ });
      const dayTwo = timeline.getByRole("tab").filter({ hasText: /^Day 2/ });
      await dayOne.click();
      await page.locator(".timeline-stop").first().locator(".action-menu__trigger").click();
      await page.getByRole("menuitem", { name: "Add a note" }).click();
      const note = page.getByRole("textbox", { name: "Note", exact: true });
      await note.fill(`draft-${viewport.width}`);
      await selectSavedTrip("Melbourne draft");
      check(
        (await page.getByRole("button", { name: /Continue editing/ }).count()) === 0,
        `a different saved Trip has no restore entry for ${viewport.width}px`,
      );
      await selectSavedTrip("Sydney draft");
      await dayTwo.click();
      await dayOne.click();

    const restore = page.getByRole("button", { name: /Continue editing/ });
    const hasRestoreEntry = await restore
      .first()
      .isVisible()
      .catch(() => false);
    if (viewport.width > 520) {
      check(
        hasRestoreEntry,
        `draft restore entry is available after day navigation at ${viewport.width}px`,
      );
    }
    if (viewport.width > 520 && hasRestoreEntry) {
      await restore.first().click();
      const restoredNote = page.getByRole("textbox", { name: "Note", exact: true });
      await restoredNote.waitFor({ state: "visible" });
      check(
        (await restoredNote.inputValue()) === `draft-${viewport.width}`,
        `note draft returns to its Stop at ${viewport.width}px`,
      );
      if (viewport.width <= 520) {
        const tabs = page.locator(".phone-tabbar");
        await tabs.getByRole("tab", { name: "Map", exact: true }).click();
        await tabs.getByRole("tab", { name: "Trip", exact: true }).click();
      } else if (viewport.width === 521) {
        const tripViews = page.getByRole("group", { name: "Trip views" });
        await tripViews.getByRole("button", { name: "Map", exact: true }).click();
        await tripViews.getByRole("button", { name: "Itinerary", exact: true }).click();
      }
      if (viewport.width === 520) {
        await page.setViewportSize({ width: 521, height: 844 });
        const tripViews = page.getByRole("group", { name: "Trip views" });
        await tripViews.getByRole("button", { name: "Map", exact: true }).click();
        await tripViews.getByRole("button", { name: "Itinerary", exact: true }).click();
        await page.setViewportSize({ width: 520, height: 844 });
        const tabs = page.locator(".phone-tabbar");
        await tabs.getByRole("tab", { name: "Map", exact: true }).click();
        await tabs.getByRole("tab", { name: "Trip", exact: true }).click();
        check(true, "a dirty note remains reachable across the 520px and 521px surfaces");
      }
      await restoredNote.press("Escape");
      const discardDialog = page.getByRole("dialog", { name: "Discard changes?" });
      await discardDialog.waitFor({ state: "visible" });
      await discardDialog.getByRole("button", { name: "Continue editing" }).click();
      check(
        (await restoredNote.inputValue()) === `draft-${viewport.width}`,
        `cancel keeps the note draft at ${viewport.width}px`,
      );
      await restoredNote.press("Escape");
      await discardDialog.getByRole("button", { name: "Discard changes", exact: true }).click();
      await discardDialog.waitFor({ state: "detached" });
      await page.locator(".trip-draft-restore button").waitFor({ state: "detached" });
      check(
        !(await page.locator(".trip-draft-restore button").count()),
        `confirmed discard clears the note draft at ${viewport.width}px`,
      );
    }
    }

    const addPlaceEntry = page.getByRole("button", { name: "Add place", exact: true });
    if (viewport.width === 521 || viewport.width === 520) {
      await addPlaceEntry.focus();
      await addPlaceEntry.press("Enter");
    } else {
      await addPlaceEntry.click();
    }
    const addForm = page.getByRole("region", { name: "Add place" });
    await addForm.getByRole("searchbox", { name: "Search places" }).fill("draft search");
    await addForm.getByLabel("Place name").fill(`Add draft ${viewport.width}`);
    await addForm.getByLabel("What you will do").fill("Keep this unfinished addition");
    await addForm.getByLabel("Start time").fill("14:00");
    await addForm.getByLabel("End time").fill("15:00");
    if (viewport.width === 520) {
      await page.setViewportSize({ width: 521, height: 844 });
      const tripViews = page.getByRole("group", { name: "Trip views" });
      await tripViews.getByRole("button", { name: "Map", exact: true }).click();
      await tripViews.getByRole("button", { name: "Itinerary", exact: true }).click();
      await page.setViewportSize({ width: 520, height: 844 });
      const tabs = page.locator(".phone-tabbar");
      await tabs.getByRole("tab", { name: "Map", exact: true }).click();
      await tabs.getByRole("tab", { name: "Trip", exact: true }).click();
    } else if (viewport.width <= 520) {
      const tabs = page.locator(".phone-tabbar");
      await tabs.getByRole("tab", { name: "Map", exact: true }).click();
      await tabs.getByRole("tab", { name: "Trip", exact: true }).click();
    } else if (viewport.width === 521) {
      const tripViews = page.getByRole("group", { name: "Trip views" });
      await tripViews.getByRole("button", { name: "Map", exact: true }).click();
      await tripViews.getByRole("button", { name: "Itinerary", exact: true }).click();
    }
    const addRestore = page.getByRole("button", { name: /Continue editing Add a stop/ });
    await addRestore.waitFor({ state: "visible" });
    await addRestore.click();
    const resumedAdd = page.getByRole("region", { name: "Add place" });
    check(
      (await resumedAdd.getByRole("searchbox", { name: "Search places" }).inputValue()) ===
        "draft search" &&
        (await resumedAdd.getByLabel("Place name").inputValue()) === `Add draft ${viewport.width}` &&
        (await resumedAdd.getByLabel("What you will do").inputValue()) ===
          "Keep this unfinished addition" &&
        (await resumedAdd.getByLabel("Start time").inputValue()) === "14:00" &&
        (await resumedAdd.getByLabel("End time").inputValue()) === "15:00",
      `AddStop draft restores its fields after navigation at ${viewport.width}px`,
    );
    if (viewport.width !== 1440) {
      await page.screenshot({ path: resolve(out, `draft-${viewport.width}.png`), fullPage: true });
      await context.close();
      continue;
    }

    await resumedAdd.getByRole("button", { name: "Cancel", exact: true }).click();
    const addDiscard = page.getByRole("dialog", { name: "Discard changes?" });
    await addDiscard.waitFor({ state: "visible" });
    await addDiscard.getByRole("button", { name: "Discard changes", exact: true }).click();
    await addDiscard.waitFor({ state: "detached" });

    const stop = timeline.locator(".timeline-stop").first();
    await stop.locator(".action-menu__trigger").click();
    await page.getByRole("menuitem", { name: "Replace place", exact: true }).click();
    const placeSearch = page.getByRole("search");
    const query = placeSearch.getByRole("searchbox");
    await query.fill(`failed-save-${viewport.width}`);
    await placeSearch.getByRole("button", { name: "Search", exact: true }).click();
    const failedSaveResponsePromise = page
      .waitForResponse((response) => response.url().endsWith("/api/trip/preview-edit"))
      .catch(() => undefined);
    await page
      .getByRole("button", { name: `Use ${second.displayName.text}`, exact: true })
      .click();
    const failedSaveResponse = await failedSaveResponsePromise;
    check(
      failedSaveResponse?.status() === 503,
      `the forced place-save failure reaches the preview-edit boundary at ${viewport.width}px`,
      { status: failedSaveResponse?.status() },
    );
    await page.locator(".timeline-status--error").filter({ hasText: "Draft fixture save failure" }).waitFor({ state: "visible" });
    check(
      (await query.inputValue()) === `failed-save-${viewport.width}`,
      `failed place save retains its query at ${viewport.width}px`,
    );
    await page.unroute("**/api/trip/preview-edit");
    const retryResponse = page.waitForResponse(
      (response) => response.url().endsWith("/api/trip/preview-edit"),
    );
    const retryButton = page.getByRole("button", {
      name: `Use ${second.displayName.text}`,
      exact: true,
    });
    const retryHandle = await retryButton.elementHandle();
    await page.waitForFunction((button) => button?.isConnected && !button.disabled, retryHandle);
    await retryButton.evaluate((button) => button.click());
    const retry = await retryResponse;
    await retry.finished();
    const retryBody = await retry.text();
    if (retry.ok()) {
      await page
        .locator(".timeline-stop")
        .filter({ hasText: second.displayName.text })
        .waitFor();
    }
    check(retry.ok(), `failed place save can be retried at ${viewport.width}px`, {
      status: retry.status(),
      body: retryBody.slice(0, 300),
    });
    await page.screenshot({ path: resolve(out, `draft-${viewport.width}.png`), fullPage: true });
    await context.close();
  }
} catch (error) {
  check(false, "draft workflow completed without an exception", String(error));
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
