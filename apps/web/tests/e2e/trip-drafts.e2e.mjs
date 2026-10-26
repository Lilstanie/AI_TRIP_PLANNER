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

try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
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
    await page.route("**/api/trip/preview-edit", (route) =>
      route.fulfill({ status: 503, json: { error: "Draft fixture save failure" } }),
    );
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
    if (viewport.width <= 520) {
      await page.getByRole("tab", { name: "Mine", exact: true }).click();
      await page.locator(".phone-mine .trip-card").first().click();
      const tripTab = page.getByRole("tab", { name: /^Trip/ });
      if (await tripTab.count()) await tripTab.click();
    } else {
      await page.getByRole("button", { name: /^Trips/ }).click();
      await page.locator(".trips-page .trip-card").first().click();
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
    const dayOne = timeline.getByRole("tab").filter({ hasText: /^Day 1/ });
    const dayTwo = timeline.getByRole("tab").filter({ hasText: /^Day 2/ });
    await dayOne.click();
    await page.locator(".timeline-stop").first().locator(".action-menu__trigger").click();
    await page.getByRole("menuitem", { name: "Add a note" }).click();
    const note = page.getByRole("textbox", { name: "Note", exact: true });
    await note.fill(`draft-${viewport.width}`);
    await dayTwo.click();
    await dayOne.click();

    const restore = page.getByRole("button", { name: /Continue editing/ });
    const hasRestoreEntry = await restore
      .first()
      .isVisible()
      .catch(() => false);
    check(
      hasRestoreEntry,
      `draft restore entry is available after day navigation at ${viewport.width}px`,
    );
    if (hasRestoreEntry) {
      await restore.first().click();
      const restoredNote = page.getByRole("textbox", { name: "Note", exact: true });
      await restoredNote.waitFor({ state: "visible" });
      check(
        (await restoredNote.inputValue()) === `draft-${viewport.width}`,
        `note draft returns to its Stop at ${viewport.width}px`,
      );
      await restoredNote.press("Escape");
      const discardDialog = page.getByRole("dialog", { name: "Discard changes?" });
      await discardDialog.waitFor({ state: "visible" });
      await discardDialog.getByRole("button", { name: "Continue editing" }).click();
      check(
        (await restoredNote.inputValue()) === `draft-${viewport.width}`,
        `cancel keeps the note draft at ${viewport.width}px`,
      );
      await restoredNote.press("Escape");
      await discardDialog.getByRole("button", { name: "Discard changes" }).click();
      check(
        !(await page.getByRole("button", { name: /Continue editing/ }).count()),
        `confirmed discard clears the note draft at ${viewport.width}px`,
      );
    }

    const stop = timeline.locator(".timeline-stop").first();
    await stop.locator(".action-menu__trigger").click();
    await page.getByRole("menuitem", { name: "Replace place", exact: true }).click();
    const placeSearch = page.getByRole("search");
    const query = placeSearch.getByRole("searchbox");
    await query.fill(`failed-save-${viewport.width}`);
    await placeSearch.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: "Use", exact: true }).click();
    await page.getByRole("alert").waitFor({ state: "visible" });
    check(
      (await query.inputValue()) === `failed-save-${viewport.width}`,
      `failed place save retains its query at ${viewport.width}px`,
    );
    await page.screenshot({ path: resolve(out, `draft-${viewport.width}.png`), fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
  const passed = checks.length > 0 && checks.every((item) => item.ok);
  writeFileSync(resolve(out, "result.json"), JSON.stringify({ passed, checks }, null, 2));
  if (!passed) process.exitCode = 1;
}
