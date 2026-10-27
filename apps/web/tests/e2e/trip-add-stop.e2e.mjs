import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip, settle, waitUntil } from "./trip-setup.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/trip-add-stop");
mkdirSync(OUT, { recursive: true });

const failures = [];
const results = [];
const check = (ok, message) => {
  const result = { ok: Boolean(ok), message };
  results.push(result);
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const browser = await chromium.launch({ headless: true });
let context;
let page;
const editRequests = [];
const chatRequests = [];
const pageErrors = [];
const waitForPlanLocation = (location) =>
  page.waitForFunction(
    (expected) => {
      const key = Object.keys(localStorage).find((item) =>
        item.startsWith("trip-workspace-catalog"),
      );
      const catalog = key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
      const trip =
        catalog?.trips?.find((item) => item.id === catalog.activeTripId) ?? catalog?.trips?.[0];
      const items =
        trip?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal?.items ??
        [];
      return items.some((item) => item.location === expected);
    },
    location,
    { timeout: 10_000 },
  );
const searchResult = {
  id: "fixture-no-coordinate-place",
  displayName: { text: "Fixture No Coordinate Place" },
  formattedAddress: "Sydney NSW, Australia",
};

try {
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.route("**/api/places/search", (route) =>
    route.fulfill({ json: { places: [searchResult] } }),
  );
  page.on("request", (request) => {
    if (request.url().endsWith("/api/trip/preview-edit")) editRequests.push(request.postDataJSON());
    if (request.url().endsWith("/api/chat")) chatRequests.push(request.postDataJSON());
  });

  await openMockWorkspace(page, BASE);
  await planSuggestedTrip(page);
  await page.getByRole("region", { name: "Trip timeline" }).waitFor();
  await waitUntil(() =>
    page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) =>
        item.startsWith("trip-workspace-catalog"),
      );
      const catalog = key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
      const trip =
        catalog?.trips?.find((item) => item.id === catalog.activeTripId) ?? catalog?.trips?.[0];
      return !!trip?.snapshot?.plan;
    }),
  );

  const apiEvidence = await page.evaluate(async () => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("trip-workspace-catalog"));
    const catalog = key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
    const trip =
      catalog?.trips?.find((item) => item.id === catalog.activeTripId) ?? catalog?.trips?.[0];
    const plan = trip?.snapshot?.plan;
    const itinerary = plan?.sections?.find((part) => part.id === "itinerary")?.proposal;
    if (!plan || !itinerary) return { missingPlan: true };
    const activities = itinerary.items.filter(
      (item) => item.kind === "activity" && item.day !== undefined,
    );
    const snapshot = activities.map(({ id, day, startTime, endTime }) => ({
      id,
      day,
      startTime,
      endTime,
    }));
    let slot;
    const tripDays =
      (Date.parse(plan.brief.dates[1]) - Date.parse(plan.brief.dates[0])) / 86_400_000 + 1;
    for (let day = 1; day <= tripDays && !slot; day += 1) {
      for (let minute = 6 * 60; minute <= 23 * 60 - 30; minute += 30) {
        const startTime = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
        const endMinute = minute + 30;
        const endTime = `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;
        if (
          !activities.some(
            (item) => item.day === day && startTime < item.endTime && endTime > item.startTime,
          )
        ) {
          slot = { day, startTime, endTime };
          break;
        }
      }
    }
    const post = async (operation) =>
      fetch("/api/trip/preview-edit", {
        method: "POST",
        headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
        body: JSON.stringify({ plan, baseVersion: plan.editVersion ?? 0, operation }),
      });
    const scheduled = await post({
      kind: "add",
      id: "e2e-added-stop",
      detail: "Fixture No Coordinate Place",
      location: "Fixture No Coordinate Place",
      ...slot,
    });
    const scheduledBody = await scheduled.json();
    const invalid = await post({
      kind: "add",
      id: "e2e-invalid-stop",
      detail: "Invalid",
      day: 1,
      startTime: "17:00",
      endTime: "16:00",
    });
    const overlapTarget = snapshot.find((item) => item.day === 1);
    const overlap = overlapTarget
      ? await post({
          kind: "add",
          id: "e2e-overlap-stop",
          detail: "Overlap",
          day: 1,
          startTime: overlapTarget.startTime,
          endTime: overlapTarget.endTime,
        })
      : undefined;
    const idea = await post({
      kind: "add",
      id: "e2e-added-idea",
      detail: "Manual Unlocated Place",
      location: "Manual Unlocated Place",
    });
    const ideaBody = await idea.json();
    const updated =
      scheduledBody.plan?.sections?.find((part) => part.id === "itinerary")?.proposal?.items ?? [];
    return {
      scheduledOk: scheduled.ok,
      slot,
      scheduled: updated.find((item) => item.id === "e2e-added-stop"),
      existingUnchanged: snapshot.every((old) => {
        const current = updated.find((item) => item.id === old.id);
        return (
          current?.day === old.day &&
          current.startTime === old.startTime &&
          current.endTime === old.endTime
        );
      }),
      invalidRejected: !invalid.ok,
      overlapRejected: overlap ? !overlap.ok : true,
      ideaOk: idea.ok,
      idea: ideaBody.plan?.sections
        ?.find((part) => part.id === "itinerary")
        ?.proposal?.items?.find((item) => item.id === "e2e-added-idea"),
    };
  });
  check(!apiEvidence.missingPlan, "the mock workspace provides a persisted Plan for edit preview");
  check(
    apiEvidence.scheduledOk &&
      apiEvidence.slot &&
      apiEvidence.scheduled?.day === apiEvidence.slot.day &&
      apiEvidence.scheduled?.startTime === apiEvidence.slot.startTime &&
      apiEvidence.scheduled?.endTime === apiEvidence.slot.endTime,
    "preview-edit adds a scheduled Stop at the explicitly requested time",
  );
  check(apiEvidence.existingUnchanged, "previewing an addition does not retime existing Stops");
  check(
    !apiEvidence.scheduled?.placeId &&
      !apiEvidence.scheduled?.savedPlace &&
      apiEvidence.scheduled?.estCost === undefined,
    "an unlocated addition retains unknown coordinates and cost",
  );
  check(
    apiEvidence.invalidRejected && apiEvidence.overlapRejected,
    "preview-edit rejects invalid schedules and overlapping additions",
  );
  check(
    apiEvidence.ideaOk &&
      apiEvidence.idea?.day === undefined &&
      apiEvidence.idea?.startTime === undefined &&
      apiEvidence.idea?.endTime === undefined,
    "preview-edit keeps Ideas unscheduled",
  );

  const add = page.getByRole("button", { name: "Add place" });
  check((await add.count()) === 1, "the Trip timeline exposes a direct Add place action");
  if (await add.count()) {
    await add.click();
    const search = page.getByRole("searchbox", { name: "Search places" });
    await search.fill("Fixture No Coordinate Place");
    await search.press("Enter");
    await page.getByRole("button", { name: "Use Fixture No Coordinate Place" }).waitFor();
    await page.getByRole("button", { name: "Use Fixture No Coordinate Place" }).click();
    await page.getByLabel("Day", { exact: true }).selectOption(String(apiEvidence.slot.day));
    await page.getByLabel("Start time").fill(apiEvidence.slot.startTime);
    await page.getByLabel("End time").fill(apiEvidence.slot.endTime);
    const previous = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) =>
        item.startsWith("trip-workspace-catalog"),
      );
      const catalog = key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
      const trip =
        catalog?.trips?.find((item) => item.id === catalog.activeTripId) ?? catalog?.trips?.[0];
      return (
        trip?.snapshot?.plan?.sections
          ?.find((part) => part.id === "itinerary")
          ?.proposal?.items?.filter((item) => item.kind === "activity" && item.day !== undefined)
          ?.map(({ id, day, startTime, endTime }) => ({ id, day, startTime, endTime })) ?? []
      );
    });
    await page.getByRole("button", { name: "Add stop" }).click();
    await waitUntil(() => editRequests.some((request) => request.operation?.kind === "add"));
    await waitForPlanLocation("Fixture No Coordinate Place");
    await page.getByRole("region", { name: "Add place" }).waitFor({ state: "detached" });
    const saved = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) =>
        item.startsWith("trip-workspace-catalog"),
      );
      const catalog = key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
      const trip =
        catalog?.trips?.find((item) => item.id === catalog.activeTripId) ?? catalog?.trips?.[0];
      return (
        trip?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal?.items ??
        []
      );
    });
    const created = saved.find((item) => item.location === "Fixture No Coordinate Place");
    if (created?.day !== undefined) {
      await page
        .locator(".timeline-stop")
        .filter({ has: page.getByText("Fixture No Coordinate Place", { exact: true }) })
        .waitFor();
    }
    check(
      created?.id &&
        created.day === apiEvidence.slot.day &&
        created.startTime === apiEvidence.slot.startTime &&
        created.endTime === apiEvidence.slot.endTime,
      "a searched place persists as a stable, scheduled Stop with the confirmed range",
    );
    check(
      !created?.savedPlace && !created?.placeId && created?.estCost === undefined,
      "a search result without coordinates or price stays unlocated and unpriced",
    );
    check(
      previous.every((item) => {
        const current = saved.find((candidate) => candidate.id === item.id);
        return (
          current?.day === item.day &&
          current.startTime === item.startTime &&
          current.endTime === item.endTime
        );
      }),
      "adding a Stop leaves every existing Stop day and time unchanged",
    );

    const secondSlot = await page.evaluate(() => {
      const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
      const trip = catalog?.trips?.find((item) => item.id === catalog.activeTripId);
      const plan = trip?.snapshot?.plan;
      const activities =
        plan?.sections
          ?.find((part) => part.id === "itinerary")
          ?.proposal?.items?.filter((item) => item.kind === "activity" && item.day !== undefined) ??
        [];
      const days =
        (Date.parse(plan?.brief?.dates?.[1]) - Date.parse(plan?.brief?.dates?.[0])) / 86_400_000 +
        1;
      for (let day = 1; day <= days; day += 1) {
        for (let minute = 6 * 60; minute <= 23 * 60 - 30; minute += 30) {
          const startTime =
            String(Math.floor(minute / 60)).padStart(2, "0") +
            ":" +
            String(minute % 60).padStart(2, "0");
          const endMinute = minute + 30;
          const endTime =
            String(Math.floor(endMinute / 60)).padStart(2, "0") +
            ":" +
            String(endMinute % 60).padStart(2, "0");
          if (
            !activities.some(
              (item) => item.day === day && startTime < item.endTime && endTime > item.startTime,
            )
          )
            return { day, startTime, endTime };
        }
      }
      return undefined;
    });
    check(Boolean(secondSlot), "the persisted Plan has a free slot for a second direct edit");
    if (secondSlot) {
      await page.getByRole("button", { name: "Add place" }).click();
      await page.getByLabel("Place name").fill("Second Direct Stop");
      await page.getByLabel("Day", { exact: true }).selectOption(String(secondSlot.day));
      await page.getByLabel("Start time").fill(secondSlot.startTime);
      await page.getByLabel("End time").fill(secondSlot.endTime);
      await page.getByRole("button", { name: "Add stop" }).click();
      await waitUntil(() =>
        editRequests.some((request) => request.operation?.location === "Second Direct Stop"),
      );
      await waitForPlanLocation("Second Direct Stop");
      await page.getByRole("region", { name: "Add place" }).waitFor({ state: "detached" });

      await page.getByRole("button", { name: "Undo last change" }).click();
      await waitUntil(() => editRequests.some((request) => request.operation?.kind === "undo"));
      await waitUntil(() =>
        page.evaluate(() => {
          const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
          const trip = catalog?.trips?.find((item) => item.id === catalog.activeTripId);
          const items =
            trip?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal
              ?.items ?? [];
          return !items.some((item) => item.location === "Second Direct Stop");
        }),
      );
      const afterUndo = await page.evaluate(() => {
        const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
        const trip = catalog?.trips?.find((item) => item.id === catalog.activeTripId);
        return (
          trip?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal
            ?.items ?? []
        );
      });
      check(
        afterUndo.some((item) => item.id === created?.id) &&
          !afterUndo.some((item) => item.location === "Second Direct Stop"),
        "Undo removes its own addition while preserving the earlier direct Stop",
      );

      const shortcut = page.getByRole("button", { name: "Ask AI about this day" });
      const beforeCancel = chatRequests.length;
      page.once("dialog", (dialog) => void dialog.dismiss());
      await shortcut.click();
      await settle(page, 250);
      check(
        chatRequests.length === beforeCancel,
        "cancelling the contextual replacement sends no request",
      );

      let beginGeneration;
      const generationStarted = new Promise((resolve) => (beginGeneration = resolve));
      let finishGeneration;
      const generationRelease = new Promise((resolve) => (finishGeneration = resolve));
      await page.route("**/api/chat", async (route) => {
        beginGeneration();
        await generationRelease;
        await route.abort();
      });
      page.once("dialog", (dialog) => void dialog.accept());
      await shortcut.click();
      await generationStarted;
      const duringGeneration = await page.evaluate(() => {
        const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
        const trip = catalog?.trips?.find((item) => item.id === catalog.activeTripId);
        return (
          trip?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal
            ?.items ?? []
        );
      });
      check(
        duringGeneration.some((item) => item.id === created?.id),
        "the current Plan remains readable while a confirmed replacement generates",
      );
      finishGeneration();
      await waitUntil(() => shortcut.isEnabled());
      const afterFailure = await page.evaluate(() => {
        const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
        const trip = catalog?.trips?.find((item) => item.id === catalog.activeTripId);
        return (
          trip?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal
            ?.items ?? []
        );
      });
      check(
        afterFailure.some((item) => item.id === created?.id),
        "a failed replacement leaves the previous Plan and direct edits intact",
      );
      await page.unroute("**/api/chat");

      const successfulPlan = await page.evaluate(() => {
        const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
        const trip = catalog?.trips?.find((item) => item.id === catalog.activeTripId);
        const plan = structuredClone(trip?.snapshot?.plan);
        if (plan?.sections?.[0]) plan.sections[0].summary = "Confirmed replacement fixture";
        return plan;
      });
      await page.route("**/api/chat", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/x-ndjson",
          body:
            JSON.stringify({
              type: "complete",
              response: { reply: "Replacement fixture completed", plan: successfulPlan },
            }) + "\n",
        }),
      );
      page.once("dialog", (dialog) => void dialog.accept());
      await shortcut.click();
      await waitUntil(() => chatRequests.length === beforeCancel + 2);
      await waitUntil(() =>
        page.evaluate(() => {
          const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
          const trip = catalog?.trips?.find((item) => item.id === catalog.activeTripId);
          return trip?.snapshot?.plan?.sections?.[0]?.summary === "Confirmed replacement fixture";
        }),
      );
      const afterSuccess = await page.evaluate(() => {
        const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
        const trip = catalog?.trips?.find((item) => item.id === catalog.activeTripId);
        return (
          trip?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal
            ?.items ?? []
        );
      });
      check(
        afterSuccess.some((item) => item.id === created?.id) &&
          successfulPlan?.sections?.[0]?.summary === "Confirmed replacement fixture",
        "a confirmed successful replacement installs its Plan while retaining manual edits",
      );
      await page.unroute("**/api/chat");
    }

    await page.reload();
    await page.waitForSelector(".workspace-app");
    await settle(page, 800);
    await page
      .locator(".workspace-sidebar")
      .getByRole("button", { name: /^Trips/ })
      .click();
    await page.locator(".trip-card").first().click();
    const openTrip = page.getByRole("button", { name: "Open your trip", exact: true });
    if ((await openTrip.getAttribute("aria-expanded")) !== "true") await openTrip.click();
    await page.getByRole("region", { name: "Trip timeline" }).waitFor();
    const restored = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) =>
        item.startsWith("trip-workspace-catalog"),
      );
      const catalog = key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
      const trip = catalog?.trips?.find((item) => item.id === catalog.activeTripId);
      return (
        trip?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal?.items ??
        []
      );
    });
    check(
      restored.some((item) => item.id === created?.id),
      "the added Stop survives reopening the Trip",
    );

    await page.getByRole("button", { name: "Add place" }).click();
    await page.getByLabel("Place name").fill("Manual Unlocated Place");
    await page.getByLabel("Start time").fill("18:00");
    await page.getByLabel("End time").fill("19:00");
    await page.getByRole("button", { name: "Save as Idea" }).click();
    await waitUntil(() =>
      editRequests.some(
        (request) =>
          request.operation?.kind === "add" &&
          request.operation.location === "Manual Unlocated Place",
      ),
    );
    await waitForPlanLocation("Manual Unlocated Place");
    const ideaPlan = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) =>
        item.startsWith("trip-workspace-catalog"),
      );
      const catalog = key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
      const trip =
        catalog?.trips?.find((item) => item.id === catalog.activeTripId) ?? catalog?.trips?.[0];
      return (
        trip?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal?.items ??
        []
      );
    });
    const idea = ideaPlan.find((item) => item.location === "Manual Unlocated Place");
    check(
      idea?.id &&
        idea.day === undefined &&
        idea.startTime === undefined &&
        idea.endTime === undefined,
      "Save as Idea discards the suggested day and times",
    );
    check(
      !idea?.placeId && !idea?.savedPlace && idea?.estCost === undefined,
      "a manually entered Idea retains unknown location and cost",
    );
    check(pageErrors.length === 0, "the Trip add journey has no browser errors");
    await page.screenshot({ path: `${OUT}/added-stop-and-idea.png`, fullPage: true });
  }
} catch (error) {
  check(false, `the Trip add journey completed without an uncaught error: ${String(error)}`);
  if (page) await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
} finally {
  if (failures.length && page)
    await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
  writeFileSync(`${OUT}/summary.json`, JSON.stringify({ results, failures, pageErrors }, null, 2));
  await context?.close();
  await browser.close();
}
if (failures.length) {
  console.error(`\n${failures.length} of ${results.length} Trip-add assertions failed.`);
  process.exitCode = 1;
}
