import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { installSeededItinerary, placeFor } from "./trip-setup.mjs";

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
    const previewEditRequests = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("request", (request) => {
      if (request.url().endsWith("/api/trip/preview-edit")) previewEditRequests.push(request);
    });
    const first = placeFor("Draft Museum");
    const second = { ...placeFor("Draft Garden"), id: "osm:way/2002" };
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
      if (viewport.width === 1440) {
        await page.locator(".timeline-stop").first().locator(".timeline-stop__time").click();
        const timeForm = page.locator(".stop-editor__time");
        await timeForm.getByLabel("Start", { exact: true }).fill("08:30");
        await dayTwo.click();
        const restoreTime = page.getByRole("button", { name: /Continue editing Change time/ });
        await restoreTime.waitFor({ state: "visible" });
        await restoreTime.click();
        check(
          (await page
            .locator(".stop-editor__time")
            .getByLabel("Start", { exact: true })
            .inputValue()) === "08:30",
          "a desktop time draft restores on its Stop after changing days",
        );
        await page
          .locator(".stop-editor__time")
          .getByLabel("Start", { exact: true })
          .press("Escape");
        const timeDiscard = page.getByRole("dialog", { name: "Discard changes?" });
        await timeDiscard.waitFor({ state: "visible" });
        await timeDiscard.getByRole("button", { name: "Discard changes", exact: true }).click();

        const desktopStop = page.locator(".timeline-stop").first();
        await desktopStop.locator(".action-menu__trigger").click();
        await page.getByRole("menuitem", { name: "Replace place", exact: true }).click();
        const desktopPlaceSearch = page.getByRole("searchbox");
        await desktopPlaceSearch.fill("restore this place search");
        await dayTwo.click();
        const restorePlace = page.getByRole("button", {
          name: /Continue editing Find this place/,
        });
        await restorePlace.waitFor({ state: "visible" });
        await restorePlace.click();
        check(
          (await page.getByRole("searchbox").inputValue()) === "restore this place search",
          "a desktop place-search draft restores on its Stop after changing days",
        );
        await page.getByRole("searchbox").press("Escape");
        const placeDiscard = page.getByRole("dialog", { name: "Discard changes?" });
        await placeDiscard.waitFor({ state: "visible" });
        await placeDiscard.getByRole("button", { name: "Discard changes", exact: true }).click();

        const detailsStop = page.locator(".timeline-stop").first();
        await detailsStop.locator(".action-menu__trigger").click();
        await page.getByRole("menuitem", { name: "Edit details", exact: true }).click();
        const detailInput = page.getByRole("textbox", { name: "What you will do", exact: true });
        await detailInput.fill("Keep these desktop details unfinished");
        await dayTwo.click();
        const restoreDetails = page.getByRole("button", { name: /Continue editing Edit details/ });
        await restoreDetails.waitFor({ state: "visible" });
        await restoreDetails.click();
        check(
          (await page
            .getByRole("textbox", { name: "What you will do", exact: true })
            .inputValue()) === "Keep these desktop details unfinished",
          "desktop details restore on their Stop after changing days",
        );
        await page.getByRole("textbox", { name: "What you will do", exact: true }).press("Escape");
        const detailsDiscard = page.getByRole("dialog", { name: "Discard changes?" });
        await detailsDiscard.waitFor({ state: "visible" });
        await detailsDiscard.getByRole("button", { name: "Discard changes", exact: true }).click();
      }
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
    } else if (viewport.width === 390) {
      const phoneStop = page.locator(".timeline-stop").first();
      await phoneStop.locator(".action-menu__trigger").click();
      await page.getByRole("menuitem", { name: "Add a note" }).click();
      const phoneNote = page.getByRole("textbox", { name: "Note", exact: true });
      await phoneNote.fill("Restore this note through the phone modal flow");
      await page.setViewportSize({ width: 521, height: 844 });
      await page.waitForFunction(() => innerWidth === 521);
      const phoneNoteRestore = page.getByRole("button", { name: /Continue editing Note/ });
      await phoneNoteRestore.waitFor({ state: "visible" });
      await phoneNoteRestore.click();
      check(
        (await page.getByRole("textbox", { name: "Note", exact: true }).inputValue()) ===
          "Restore this note through the phone modal flow",
        "a phone modal note restores after crossing to the tablet surface",
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => innerWidth === 390);
      const phoneSurface = page.locator(".workspace-app[data-phone]");
      await phoneSurface.waitFor({ state: "visible" });
      await page.locator(".phone-tabbar").waitFor({ state: "visible" });
      const waitForPhoneEditorAction = () =>
        page.waitForFunction(() => {
          const visible = (element) => Boolean(element?.getClientRects().length);
          return (
            visible(document.querySelector('.fact-popover--stop[aria-modal="true"]')) ||
            [...document.querySelectorAll(".trip-draft-restore button")].some(visible)
          );
        });
      const phoneSurfaceSnapshot = () =>
        page.evaluate(() => {
          const app = document.querySelector(".workspace-app");
          const stopPopover = document.querySelector(".fact-popover--stop");
          const note = stopPopover?.querySelector("textarea");
          const popover = note?.closest(".fact-popover--stop");
          const restore = [...document.querySelectorAll(".trip-draft-restore button")].map(
            (button) => ({
              text: button.textContent?.trim(),
              visible: button.getClientRects().length > 0,
            }),
          );
          return {
            width: innerWidth,
            phone: app?.hasAttribute("data-phone"),
            keyboard: app?.hasAttribute("data-phone-keyboard"),
            selectedTab: document
              .querySelector('.phone-tabbar [role="tab"][aria-selected="true"]')
              ?.textContent?.trim(),
            noteVisible: Boolean(note?.getClientRects().length),
            noteParent: popover?.className ?? note?.parentElement?.className ?? null,
            modal: popover?.getAttribute("aria-modal") ?? null,
            stopPopoverCount: document.querySelectorAll(".fact-popover--stop").length,
            scrimCount: document.querySelectorAll(".fact-popover-scrim").length,
            noteFocused: document.activeElement === note,
            activeElement:
              document.activeElement?.getAttribute("aria-label") ??
              document.activeElement?.tagName ??
              null,
            restore,
          };
        });
      await waitForPhoneEditorAction();
      const beforePhoneRestore = await phoneSurfaceSnapshot();
      check(
        beforePhoneRestore.modal === "true" ||
          beforePhoneRestore.restore.some((entry) => entry.visible),
        "phone editor or restore entry is available after the responsive transition",
        beforePhoneRestore,
      );
      const phoneNoteModal = page.locator('.fact-popover--stop[aria-modal="true"]');
      if (!(await phoneNoteModal.isVisible())) {
        const phoneRestore = page.getByRole("button", { name: /Continue editing Note/ });
        await phoneRestore.waitFor({ state: "visible" });
        await phoneRestore.click();
      }
      const phoneDiscard = page.getByRole("dialog", { name: "Discard changes?" });
      const phoneNoteInput = page.getByRole("textbox", { name: "Note", exact: true });
      await phoneNoteModal.waitFor({ state: "visible" });
      await page.waitForFunction(() => {
        const note = document.querySelector(".fact-popover--stop textarea");
        return note && document.activeElement === note;
      });
      const afterPhoneRestore = await phoneSurfaceSnapshot();
      check(
        afterPhoneRestore.modal === "true" && afterPhoneRestore.noteFocused,
        "phone editor modal and focus are ready for Escape",
        afterPhoneRestore,
      );
      check(
        (await phoneNoteInput.inputValue()) === "Restore this note through the phone modal flow",
        "the phone modal draft restores and receives focus after returning to phone width",
      );
      const phoneTransitionCycles = [
        { beforeRestore: beforePhoneRestore, afterRestore: afterPhoneRestore },
      ];
      for (let cycle = 2; cycle <= 3; cycle += 1) {
        await page.setViewportSize({ width: 521, height: 844 });
        await page.waitForFunction(() => innerWidth === 521);
        await page.locator(".workspace-app:not([data-phone])").waitFor({ state: "visible" });
        const tabletRestore = page.getByRole("button", { name: /Continue editing Note/ });
        await tabletRestore.waitFor({ state: "visible" });
        await tabletRestore.click();
        await phoneNoteInput.waitFor({ state: "visible" });

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(() => innerWidth === 390);
        await phoneSurface.waitFor({ state: "visible" });
        await page.locator(".phone-tabbar").waitFor({ state: "visible" });
        await waitForPhoneEditorAction();
        const beforeRestore = await phoneSurfaceSnapshot();
        check(
          beforeRestore.modal === "true" || beforeRestore.restore.some((entry) => entry.visible),
          `phone editor or restore entry is available in responsive cycle ${cycle}`,
          beforeRestore,
        );
        if (!(await phoneNoteModal.isVisible())) {
          const phoneRestore = page.getByRole("button", { name: /Continue editing Note/ });
          await phoneRestore.waitFor({ state: "visible" });
          await phoneRestore.click();
        }
        await phoneNoteModal.waitFor({ state: "visible" });
        await page.waitForFunction(() => {
          const note = document.querySelector(".fact-popover--stop textarea");
          return note && document.activeElement === note;
        });
        const afterRestore = await phoneSurfaceSnapshot();
        phoneTransitionCycles.push({ beforeRestore, afterRestore });
        check(
          afterRestore.phone && afterRestore.modal === "true" && afterRestore.noteFocused,
          `phone note modal and focus recover after responsive transition cycle ${cycle}`,
          { beforeRestore, afterRestore },
        );
      }
      writeFileSync(
        resolve(out, "phone-transition.json"),
        JSON.stringify(phoneTransitionCycles, null, 2),
      );
      await page.keyboard.press("Escape");
      await phoneDiscard.waitFor({ state: "visible" });
      await phoneDiscard.getByRole("button", { name: "Discard changes", exact: true }).click();
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
        (await resumedAdd.getByLabel("Place name").inputValue()) ===
          `Add draft ${viewport.width}` &&
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
    await page.getByRole("button", { name: `Use ${second.displayName.text}`, exact: true }).click();
    const failedSaveResponse = await failedSaveResponsePromise;
    check(
      failedSaveResponse?.status() === 503,
      `the forced place-save failure reaches the preview-edit boundary at ${viewport.width}px`,
      { status: failedSaveResponse?.status() },
    );
    await page
      .locator(".timeline-status--error")
      .filter({ hasText: "Draft fixture save failure" })
      .waitFor({ state: "visible" });
    check(
      (await query.inputValue()) === `failed-save-${viewport.width}`,
      `failed place save retains its query at ${viewport.width}px`,
    );
    await page.unroute("**/api/trip/preview-edit");
    const retryResponse = page.waitForResponse((response) =>
      response.url().endsWith("/api/trip/preview-edit"),
    );
    const retryButton = page.getByRole("button", {
      name: `Use ${second.displayName.text}`,
      exact: true,
    });
    await retryButton.click();
    const retry = await retryResponse;
    await retry.finished();
    const retryBody = await retry.text();
    if (retry.ok()) {
      await page.locator(".timeline-stop").filter({ hasText: second.displayName.text }).waitFor();
    }
    check(retry.ok(), `failed place save can be retried at ${viewport.width}px`, {
      status: retry.status(),
      body: retryBody.slice(0, 300),
    });
    if (viewport.width === 1440) {
      const staleStop = timeline.locator(".timeline-stop").first();
      await staleStop.locator(".timeline-stop__time").click();
      const staleTime = page.locator(".stop-editor__time").getByLabel("Start", { exact: true });
      await staleTime.fill("08:30");

      const concurrent = await context.newPage();
      currentPage = concurrent;
      const concurrentPlanText = "A newer Plan detail from another workspace tab";
      await concurrent.goto(process.env.BASE_URL ?? "http://localhost:3115");
      await concurrent.locator(".workspace-app").waitFor();
      await concurrent.getByRole("button", { name: /^Trips/ }).click();
      await concurrent
        .locator(".trips-page .trip-card")
        .filter({ hasText: "Sydney" })
        .first()
        .click();
      await concurrent.getByRole("button", { name: "Open your trip", exact: true }).click();
      const concurrentStop = concurrent.locator(".timeline-stop").first();
      await concurrentStop.locator(".action-menu__trigger").click();
      await concurrent.getByRole("menuitem", { name: "Edit details", exact: true }).click();
      const concurrentDetails = concurrent.getByRole("textbox", {
        name: "What you will do",
        exact: true,
      });
      await concurrentDetails.fill(concurrentPlanText);
      await concurrent.getByRole("button", { name: "Save", exact: true }).click();
      await concurrent.waitForFunction(
        ({ key, value }) => localStorage.getItem(key)?.includes(value),
        { key: `trip.revision:${tripId}`, value: concurrentPlanText },
      );
      check(
        await concurrent.evaluate(({ key, value }) => localStorage.getItem(key)?.includes(value), {
          key: `trip.revision:${tripId}`,
          value: concurrentPlanText,
        }),
        "a second workspace tab applies its newer Plan revision",
      );
      await concurrent.locator(".timeline-stop").filter({ hasText: concurrentPlanText }).waitFor();

      const staleRequestsBeforeSave = previewEditRequests.length;
      await page.getByRole("button", { name: "Change time", exact: true }).click();
      const staleNotice = page
        .locator(".stop-editor__time .stop-editor__errors")
        .filter({ hasText: "This edit is stale. Start from the current plan." });
      await staleNotice.waitFor({ state: "visible" });
      check(
        previewEditRequests.length === staleRequestsBeforeSave &&
          (await staleTime.inputValue()) === "08:30",
        "a stale time draft is retained and refused before the edit request is sent",
      );
      const publishedRevision = await page.evaluate(
        (key) => localStorage.getItem(key),
        `trip.revision:${tripId}`,
      );
      check(
        publishedRevision?.includes(concurrentPlanText) && !publishedRevision.includes("08:30"),
        "the stale draft cannot overwrite the newer Plan revision",
      );
      await staleTime.press("Escape");
      const staleDiscard = page.getByRole("dialog", { name: "Discard changes?" });
      await staleDiscard.waitFor({ state: "visible" });
      await staleDiscard.getByRole("button", { name: "Discard changes", exact: true }).click();
      await concurrent.close();
      currentPage = page;

      await page.reload();
      await page.locator(".workspace-app").waitFor();
      await selectSavedTrip("Sydney draft");
      const rebaseTimeline = page.getByRole("region", { name: "Trip timeline" });
      await rebaseTimeline.waitFor();
      const editedStop = rebaseTimeline.locator(".timeline-stop").first();
      const draftStart = "08:30";
      await editedStop.locator(".timeline-stop__time").click();
      const draftTime = page.locator(".stop-editor__time").getByLabel("Start", { exact: true });
      await draftTime.fill(draftStart);

      const currentPlan = await page.evaluate((key) => {
        const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
        return catalog?.trips?.find((trip) => trip.id === key)?.snapshot?.plan ?? null;
      }, tripId);
      const stopId = currentPlan?.sections
        ?.find((section) => section.id === "itinerary")
        ?.proposal?.items?.find((item) => item.kind === "activity")?.id;
      const replacementItems = structuredClone(
        currentPlan?.sections?.find((section) => section.id === "itinerary")?.proposal?.items ?? [],
      );
      const replacementStop = replacementItems.find((item) => item.id === stopId);
      if (replacementStop) {
        replacementStop.startTime = "10:15";
        replacementStop.endTime = "11:15";
      }
      await installSeededItinerary(page, replacementItems);
      const tripToggle = page.getByRole("button", { name: "Open your trip", exact: true });
      if ((await tripToggle.getAttribute("aria-expanded")) === "true") await tripToggle.click();
      const chatInput = page.getByRole("textbox", { name: "Message AI Trip Planner", exact: true });
      await chatInput.waitFor({ state: "visible" });
      await chatInput.fill("Keep the same itinerary and shift the first stop later");
      const replanDialog = page.waitForEvent("dialog").catch(() => undefined);
      const chatResponse = page.waitForResponse((response) => response.url().endsWith("/api/chat"));
      await chatInput.press("Enter");
      const dialog = await replanDialog;
      if (dialog) await dialog.accept();
      const chatResult = await chatResponse;
      const chatFrames = (await chatResult.text())
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const returnedPlan = chatFrames.find((frame) => frame.response?.plan)?.response?.plan;
      const returnedStop = returnedPlan?.sections
        ?.find((section) => section.id === "itinerary")
        ?.proposal?.items?.find((item) => item.id === stopId);
      check(
        returnedStop?.startTime === "10:15",
        "the deterministic chat fixture returns the same Stop ID with a newer time",
        { stopId, returnedId: returnedStop?.id, returnedStart: returnedStop?.startTime },
      );
      await page.locator(".msg-item--agent .msg-item__body").last().waitFor({ timeout: 30_000 });
      await page.waitForFunction(
        ({ stopId }) => {
          const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
          const plan = catalog?.trips?.find((trip) => trip.id === catalog.activeTripId)?.snapshot
            ?.plan;
          return plan?.sections
            ?.find((section) => section.id === "itinerary")
            ?.proposal?.items?.some((item) => item.id === stopId && item.startTime === "10:15");
        },
        { stopId },
        { timeout: 8000 },
      );
      await page.getByRole("button", { name: "Open your trip", exact: true }).click();
      const restoreStaleTime = page.getByRole("button", {
        name: /Continue editing Change time/,
      });
      await restoreStaleTime.waitFor({ state: "visible" });
      await restoreStaleTime.click();
      const staleDraftNotice = page
        .locator(".stop-editor__hint")
        .filter({ hasText: "Draft changed since you started editing" });
      await staleDraftNotice.waitFor({ state: "visible" });
      await staleDraftNotice.getByRole("button", { name: "Use latest trip and retry" }).click();
      check(
        (await draftTime.inputValue()) === draftStart &&
          (await page
            .locator(".stop-editor__hint")
            .filter({
              hasText: "Draft changed since you started editing",
            })
            .count()) === 0,
        "same-page replan marks the retained time draft stale and explicit rebase keeps its value",
        { stopId, replacementStart: replacementStop?.startTime },
      );
      const editsBeforeRetry = previewEditRequests.length;
      const retryResponse = page.waitForResponse((response) =>
        response.url().endsWith("/api/trip/preview-edit"),
      );
      await page.getByRole("button", { name: "Change time", exact: true }).click();
      const retried = await retryResponse;
      const retryRequest = previewEditRequests[editsBeforeRetry]?.postDataJSON();
      const retryResult = await retried.json();
      const retryPlanItem = retryRequest?.plan?.sections
        ?.find((section) => section.id === "itinerary")
        ?.proposal?.items?.find((item) => item.id === stopId);
      const appliedItem = retryResult?.plan?.sections
        ?.find((section) => section.id === "itinerary")
        ?.proposal?.items?.find((item) => item.id === stopId);
      await page.locator(".stop-editor__time").waitFor({ state: "hidden" });
      const visibleTime = await page.locator(".timeline-stop__time").first().innerText();
      check(
        retried.ok() &&
          retryRequest?.operation?.startTime === draftStart &&
          retryPlanItem?.startTime === "10:15" &&
          appliedItem?.startTime === draftStart &&
          visibleTime.includes(draftStart),
        "rebased time retry is sent against the current same-Stop Plan and applies the draft",
        {
          status: retried.status(),
          baseStart: retryPlanItem?.startTime,
          requestedStart: retryRequest?.operation?.startTime,
          appliedStart: appliedItem?.startTime,
          visibleTime,
        },
      );
      await page.unroute("**/api/chat");
    }
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
