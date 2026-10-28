import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor } from "./trip-setup.mjs";
import { openTripWorkspace } from "./support/e2e-helpers.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/trip-review-recovery",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHANNEL });
const savedAt = "2026-10-26T00:00:00Z";
const results = [];
try {
  for (const scenario of (
    process.env.RECOVERY_CASE ?? "chat,undo,background-note,background-time,background-route"
  ).split(",")) {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      const previews = [];
      page.on("response", async (response) => {
        if (!response.url().includes("/api/trip/preview-edit")) return;
        previews.push({
          request: response.request().postDataJSON(),
          response: await response.json().catch(() => null),
        });
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(8000);
      const first = placeFor("Draft Museum");
      const second = { ...placeFor("Draft Garden"), id: "osm:way/2002" };
      await page.route("**/api/places/details", (route) => {
        const { placeId } = route.request().postDataJSON();
        return route.fulfill({ json: { place: placeId === first.id ? first : second } });
      });
      let releaseLookup;
      const lookupReady = new Promise((resolve) => {
        releaseLookup = resolve;
      });
      if (scenario.startsWith("background-")) {
        await page.route("**/api/places/search", async (route) => {
          await lookupReady;
          await route.fulfill({ json: { places: [first] } }).catch(() => undefined);
        });
      }
      if (scenario === "background-route") {
        await page.route("**/api/trip/preview-edit", async (route) => {
          if (route.request().postDataJSON().operation.kind === "verify") await lookupReady;
          await route.continue().catch(() => undefined);
        });
      }
      const requests = [];
      await page.route("**/api/chat", (route) => {
        requests.push(route.request().postDataJSON());
        return route.fulfill({ status: 503, json: { error: "Review fixture reply failure" } });
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
        editVersion: 1,
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
                {
                  id: "review-idea",
                  kind: "activity",
                  detail: "Draft Idea",
                  location: "Draft Idea",
                },
              ],
              assumptions: [],
              conflictsWith: [],
            },
          },
        ],
      };
      if (scenario === "background-route") plan.sections[0].proposal.items[1].day = 1;
      else if (scenario.startsWith("background-"))
        delete plan.sections[0].proposal.items[0].placeId;
      const conversationId = `conversation:draft-conversation-${viewport.width}`;
      const snapshot = {
        version: 4,
        id: conversationId.replace(/^conversation:/, ""),
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
        messages: [
          { role: "user", text: "Plan the original Sydney visit", at: 1 },
          { role: "agent", text: "Original itinerary reply", at: 2 },
        ],
        input: "",
      };
      const otherTripId = `draft-trip-alternate-${viewport.width}`;
      const otherConversationId = `conversation:draft-conversation-alternate-${viewport.width}`;
      const otherPlan = structuredClone(plan);
      otherPlan.tripId = otherTripId;
      otherPlan.brief.tripId = otherTripId;
      otherPlan.brief.destination = "Melbourne";
      otherPlan.sections[0].proposal.items.forEach((item) => {
        item.id = `${item.id}-alternate`;
      });
      const otherSnapshot = {
        ...snapshot,
        id: otherConversationId.replace(/^conversation:/, ""),
        plan: otherPlan,
      };
      const catalog = {
        version: 4,
        activeConversationId: conversationId,
        activeTripId: `trip:${tripId}`,
        conversations: [
          {
            id: conversationId,
            title: "Sydney draft",
            updatedAt: savedAt,
            tripId: `trip:${tripId}`,
            messages: [
              { role: "user", text: "Plan the original Sydney visit", at: 1 },
              { role: "agent", text: "Original itinerary reply", at: 2 },
            ],
            input: "",
            snapshot,
          },
          {
            id: otherConversationId,
            title: "Melbourne draft",
            updatedAt: savedAt,
            tripId: `trip:${otherTripId}`,
            messages: [
              { role: "user", text: "Plan the original Sydney visit", at: 1 },
              { role: "agent", text: "Original itinerary reply", at: 2 },
            ],
            input: "",
            snapshot: otherSnapshot,
          },
        ],
        trips: [
          {
            id: `trip:${tripId}`,
            title: "Sydney draft",
            status: "draft",
            updatedAt: savedAt,
            conversationIds: [conversationId],
            snapshot,
          },
          {
            id: `trip:${otherTripId}`,
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
      await page.addStyleTag({ content: "nextjs-portal {display:none !important;}" });
      await page.locator(".workspace-app").waitFor();
      const selectSavedTrip = async (title) => {
        const destination = title.startsWith("Melbourne") ? "Melbourne" : "Sydney";
        if (page.viewportSize().width <= 520) {
          await page.getByRole("tab", { name: "Mine", exact: true }).click();
          await openTripWorkspace(
            page,
            page.locator(".phone-mine .trip-card").filter({ hasText: destination }).first(),
          );
          const tripTab = page.getByRole("tab", { name: "Trip", exact: true });
          if (await tripTab.count()) await tripTab.click();
        } else {
          if (page.viewportSize().width <= 900) {
            await page.getByRole("button", { name: "Open navigation", exact: true }).click();
          }
          await page.getByRole("button", { name: /^Trips/ }).click();
          await openTripWorkspace(
            page,
            page.locator(".trips-page .trip-card").filter({ hasText: destination }).first(),
          );
          const openTrip = page.getByRole("button", { name: "Open your trip", exact: true });
          if ((await openTrip.getAttribute("aria-expanded")) !== "true") await openTrip.click();
        }
      };
      await selectSavedTrip("Sydney draft");
      const openChat = async () => {
        if (page.viewportSize().width <= 520)
          await page.getByRole("tab", { name: "Chat", exact: true }).click();
        else await page.getByRole("button", { name: "Open your trip", exact: true }).click();
      };
      const openTrip = async () => {
        if (page.viewportSize().width <= 520)
          await page.getByRole("tab", { name: "Trip", exact: true }).click();
        else await page.getByRole("button", { name: "Open your trip", exact: true }).click();
      };
      try {
        if (scenario === "chat") {
          await openChat();
          await page.getByRole("button", { name: "Edit message", exact: true }).first().click();
          const edited = page.getByRole("textbox", { name: "Edit message", exact: true });
          await edited.fill("Keep this unfinished message revision");
          page.once("dialog", (dialog) => dialog.dismiss());
          await page.getByRole("button", { name: "Resend", exact: true }).click();
          assert.equal(await edited.inputValue(), "Keep this unfinished message revision");
          assert.equal(
            await page.getByText("Original itinerary reply", { exact: true }).count(),
            1,
          );
          assert.equal(requests.length, 0);
          await page.screenshot({ path: resolve(out, `cancel-resend-${viewport.width}.png`) });
          page.once("dialog", (dialog) => dialog.accept());
          await page.getByRole("button", { name: "Resend", exact: true }).click();
          await page.getByRole("button", { name: "Retry update", exact: true }).waitFor();
          assert.equal(requests.length, 1);
          assert.equal(requests[0].message, "Keep this unfinished message revision");
          assert.equal(
            await page.getByText("Original itinerary reply", { exact: true }).count(),
            0,
          );
          await openTrip();
          page.once("dialog", (dialog) => dialog.dismiss());
          await page.getByRole("button", { name: "Day 1 actions", exact: true }).click();
          await page.getByRole("menuitem", { name: "Ask AI", exact: true }).click();
          assert.equal(requests.length, 1);
          assert.equal(
            await page.getByRole("region", { name: "Trip timeline", exact: true }).isVisible(),
            true,
          );
          page.once("dialog", (dialog) => dialog.accept());
          await page.getByRole("button", { name: "Day 1 actions", exact: true }).click();
          await page.getByRole("menuitem", { name: "Ask AI", exact: true }).click();
          await page.getByRole("button", { name: "Retry update", exact: true }).waitFor();
          assert.equal(requests.length, 2);
          assert.match(requests[1].message, /Day 1/);
          assert.equal(await page.locator(".composer__input").isVisible(), true);
          await page.screenshot({ path: resolve(out, `ai-reply-${viewport.width}.png`) });
        } else if (scenario.startsWith("background-")) {
          const stop = page.locator(".timeline-stop").filter({ hasText: "Draft Museum" });
          if (scenario !== "background-time") {
            await stop.locator(".action-menu__trigger").click();
            await page.getByRole("menuitem", { name: "Add a comment", exact: true }).click();
            await page
              .getByRole("textbox", { name: "Comment", exact: true })
              .fill("Undo this note only");
            await page.getByRole("button", { name: "Save", exact: true }).click();
          } else {
            await stop.getByRole("button", { name: /^Change time,/ }).click();
            await page.getByLabel("Start", { exact: true }).fill("09:15");
            await page.getByLabel("End", { exact: true }).fill("10:15");
            await page.getByRole("button", { name: "Change time", exact: true }).click();
          }
          const undoButton = page.getByRole("button", { name: /^Undo/ });
          await undoButton.waitFor();
          releaseLookup();
          const savedStop = (index = 0) =>
            page.evaluate(
              ({ tripId, index }) => {
                const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3"));
                return catalog.trips
                  .find((trip) => trip.id === `trip:${tripId}`)
                  ?.snapshot.plan.sections.find((section) => section.id === "itinerary")?.proposal
                  .items[index];
              },
              { tripId, index },
            );
          await page.waitForFunction(
            ({ tripId, index, placeId }) => {
              const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3"));
              const item = catalog.trips
                .find((trip) => trip.id === `trip:${tripId}`)
                ?.snapshot.plan.sections.find((section) => section.id === "itinerary")?.proposal
                .items[index];
              return index === 1 ? !!item?.arriveBy : item?.placeId === placeId;
            },
            { tripId, index: scenario === "background-route" ? 1 : 0, placeId: first.id },
          );
          const backgroundStop = await savedStop(scenario === "background-route" ? 1 : 0);
          await undoButton.click();
          if (scenario !== "background-time")
            await stop
              .getByText("Undo this note only", { exact: true })
              .waitFor({ state: "detached" });
          else await stop.getByRole("button", { name: /^Change time, 09:00.*10:00/ }).waitFor();
          await page.waitForFunction((tripId) => {
            const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3"));
            const item = catalog.trips
              .find((trip) => trip.id === `trip:${tripId}`)
              ?.snapshot.plan.sections.find((section) => section.id === "itinerary")?.proposal
              .items[0];
            return (
              item?.note === undefined && item?.startTime === "09:00" && item?.endTime === "10:00"
            );
          }, tripId);
          const restored = await savedStop();
          assert.equal(restored.placeId, first.id);
          if (scenario === "background-route")
            assert.deepEqual((await savedStop(1)).arriveBy, backgroundStop.arriveBy);
          else {
            assert.equal(restored.savedPlace.name, first.displayName.text);
            assert.equal(restored.priceNeedsReview, true);
          }
          assert.equal(restored.note, undefined);
          assert.equal(restored.startTime, "09:00");
          assert.equal(restored.endTime, "10:00");
          assert.equal(await undoButton.count(), 0);
          await page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}.png`) });
        } else if (scenario === "undo") {
          const stop = page.locator(".timeline-stop").filter({ hasText: "Draft Museum" });
          await stop.locator(".action-menu__trigger").click();
          await page.getByRole("menuitem", { name: "Add a comment", exact: true }).click();
          await page
            .getByRole("textbox", { name: "Comment", exact: true })
            .fill("Last manual note");
          await page.getByRole("button", { name: "Save", exact: true }).click();
          await page.getByRole("button", { name: "Undo", exact: true }).waitFor();
          await openChat();
          await openTrip();
          await page.getByRole("button", { name: "Undo", exact: true }).waitFor();
          await selectSavedTrip("Melbourne alternate");
          assert.equal(await page.getByRole("button", { name: /^Undo/ }).count(), 0);
          await selectSavedTrip("Sydney draft");
          if (viewport.width <= 520) await page.setViewportSize({ width: 521, height: 844 });
          await page.getByRole("button", { name: "Undo", exact: true }).click();
          await page.getByText("Last manual note", { exact: true }).waitFor({ state: "detached" });
          assert.equal(await page.getByRole("button", { name: /^Undo/ }).count(), 0);
          await stop.getByRole("button", { name: /^Change time,/ }).click();
          await page.getByLabel("Start", { exact: true }).fill("09:15");
          await page.getByLabel("End", { exact: true }).fill("10:15");
          await page.getByRole("button", { name: "Change time", exact: true }).click();
          await page.getByRole("button", { name: "Undo last change", exact: true }).waitFor();
          await openChat();
          await openTrip();
          await page.getByRole("button", { name: "Undo last change", exact: true }).click();
          await stop.getByRole("button", { name: /^Change time, 09:00/ }).waitFor();
          assert.equal(await page.getByRole("button", { name: /^Undo/ }).count(), 0);
          for (const note of ["First manual note", "Second manual note"]) {
            await stop.locator(".action-menu__trigger").click();
            await page.getByRole("menuitem", { name: /^Add a comment$/, exact: true }).click();
            await page.getByRole("textbox", { name: "Comment", exact: true }).fill(note);
            await page.getByRole("button", { name: "Save", exact: true }).click();
          }
          await page.getByRole("button", { name: "Undo", exact: true }).click();
          await stop.getByText("First manual note", { exact: true }).waitFor();
          assert.equal(await stop.getByText("Second manual note", { exact: true }).count(), 0);
          assert.equal(await page.getByRole("button", { name: /^Undo/ }).count(), 0);
          await stop.getByRole("button", { name: /^Change time,/ }).click();
          await page.getByLabel("Start", { exact: true }).fill("09:15");
          await page.getByLabel("End", { exact: true }).fill("10:15");
          await page.getByRole("button", { name: "Change time", exact: true }).click();
          await page.getByRole("button", { name: "Undo last change", exact: true }).waitFor();
          const replacement = structuredClone(plan);
          replacement.round = 2;
          replacement.editVersion = 0;
          replacement.sections[0].proposal.items[0].startTime = "10:00";
          replacement.sections[0].proposal.items[0].endTime = "11:00";
          await page.unroute("**/api/chat");
          await page.route("**/api/chat", (route) =>
            route.fulfill({
              contentType: "application/x-ndjson",
              body:
                JSON.stringify({
                  type: "complete",
                  response: { reply: "Replacement itinerary ready", plan: replacement },
                }) + "\n",
            }),
          );
          await openChat();
          await page.locator(".composer__input").fill("Replan this trip");
          page.once("dialog", (dialog) => dialog.accept());
          await page.locator(".composer__input").press("Enter");
          await page.getByText("Replacement itinerary ready", { exact: true }).waitFor();
          await openTrip();
          await stop.getByRole("button", { name: /^Change time, 10:00.*11:00/ }).waitFor();
          assert.equal(await page.getByRole("button", { name: /^Undo/ }).count(), 0);
          await page.screenshot({ path: resolve(out, `undo-${viewport.width}.png`) });
        }
        assert.deepEqual(errors, []);
        const layout = await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        assert.equal(layout.scrollWidth, layout.width);
        results.push({
          scenario,
          width: viewport.width,
          finalWidth: layout.width,
          ok: true,
          pageErrors: errors,
        });
      } catch (error) {
        writeFileSync(
          resolve(out, `${scenario}-previews-${viewport.width}.json`),
          JSON.stringify(previews, null, 2),
        );
        writeFileSync(
          resolve(out, `${scenario}-geometry-${viewport.width}.json`),
          JSON.stringify(
            await page
              .locator(
                ".workspace-shell, .trip-workspace, .trip-workspace__timeline, .trip-panel, .trip-editor, .action-menu__trigger, .action-menu__list",
              )
              .evaluateAll((elements) =>
                elements.map((element) => ({
                  cls: element.className,
                  rect: element.getBoundingClientRect().toJSON(),
                  height: element.clientHeight,
                  scrollHeight: element.scrollHeight,
                  scrollTop: element.scrollTop,
                  overflow: getComputedStyle(element).overflowY,
                  grid: getComputedStyle(element).gridTemplateRows,
                })),
              ),
            null,
            2,
          ),
        );
        await page.screenshot({ path: resolve(out, `${scenario}-failure-${viewport.width}.png`) });
        results.push({ scenario, width: viewport.width, ok: false, error: String(error) });
        console.error(error);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(resolve(out, "checks.json"), JSON.stringify(results, null, 2));
}
console.log(results);
if (results.some((result) => !result.ok)) process.exitCode = 1;
