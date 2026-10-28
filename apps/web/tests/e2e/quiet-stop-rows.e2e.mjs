import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor, waitUntil } from "./trip-setup.mjs";
import { openTripWorkspace } from "./support/e2e-helpers.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/quiet-stop-rows",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const savedAt = "2026-10-28T00:00:00Z";
const BASE = process.env.BASE_URL ?? "http://localhost:3115";
const browser = await chromium.launch({ channel: process.env.CHANNEL });
let currentPage;

const REMOVED_TAGS = /Place confirmed|Price needs checking|地点已确认|价格待核实/;
const SENTENCE = /Drag a stop to reorder|拖动停靠点调整顺序/;
const CLEAR = ["rgba(0, 0, 0, 0)", "transparent"];

try {
  for (const viewport of [
    { width: 1440, height: 1500 },
    { width: 390, height: 844 },
    { width: 1440, height: 1500, zh: true },
  ]) {
    const phone = viewport.width <= 520;
    const zh = Boolean(viewport.zh);
    const tag = `${viewport.width}px${zh ? " zh" : ""}`;
    const suffix = `${viewport.width}${zh ? "-zh" : ""}`;
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
      ...(phone ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await context.newPage();
    currentPage = page;
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.route("**/api/places/details", (route) => {
      const { placeId } = route.request().postDataJSON();
      return route.fulfill({ json: { place: placeFor(placeId.replace(/^stub:/, "")) } });
    });
    await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));

    const tripId = `quiet-trip-${suffix}`;
    const activity = (name, day, startTime, endTime, extra = {}) => ({
      id: `${name.toLowerCase()}-${suffix}`,
      kind: "activity",
      ...(day === undefined ? {} : { day }),
      ...(startTime ? { startTime, endTime } : {}),
      location: name,
      detail: name,
      placeId: placeFor(name).id,
      ...extra,
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
      estTotal: 400,
      overrunPct: -80,
      sections: [
        {
          id: "itinerary",
          label: "Day plan",
          status: "draft",
          summary: "Sydney visit",
          estCost: 105,
          proposal: {
            agent: "itinerary",
            summary: "Sydney visit",
            items: [
              activity("Alder", 1, "09:00", "10:00", { estCost: 25 }),
              activity("Birch", 1, "09:30", "10:30"),
              activity("Cedar", 1, "13:00", "14:00", { estCost: 40, priceNeedsReview: true }),
              activity("Dune", 2),
              activity("Elm", 2, "11:00", "12:00", { estCost: 40 }),
              activity("Fir", undefined),
            ],
            assumptions: [],
            conflictsWith: [],
          },
        },
        {
          id: "transport",
          label: "Transport",
          status: "draft",
          summary: "Flight",
          estCost: 80,
          proposal: {
            agent: "transport",
            summary: "Flight",
            assumptions: [],
            conflictsWith: [],
            items: [
              {
                id: "flight-item",
                kind: "flight",
                detail: "Selected fixture flight",
                day: 1,
                selectionId: "flight-1",
                estCost: 80,
              },
            ],
            flights: [
              {
                id: "flight-1",
                from: "MEL",
                to: "SYD",
                depart: "2030-10-01",
                day: 1,
                passengers: 2,
                selectedId: "flight-selected",
                candidates: [{ id: "flight-selected", carrier: "Selected Air", price: 40 }],
              },
            ],
          },
        },
        {
          id: "accommodation",
          label: "Stay",
          status: "draft",
          summary: "Harbour Inn",
          estCost: 300,
          proposal: {
            agent: "accommodation",
            summary: "Harbour Inn",
            items: [
              {
                id: "stay-item",
                kind: "stay",
                day: 1,
                selectionId: "stay-1",
                detail: "Harbour Inn — Circular Quay; 1 room × 3 nights × A$100.00",
                estCost: 300,
              },
            ],
            assumptions: [],
            conflictsWith: [],
            stays: [
              {
                id: "stay-1",
                city: "Sydney",
                checkIn: "2030-10-01",
                checkOut: "2030-10-04",
                day: 1,
                nights: 3,
                rooms: 1,
                selectedId: "room-1",
                candidates: [
                  {
                    id: "room-1",
                    name: "Harbour Inn",
                    area: "Circular Quay",
                    pricePerNight: 100,
                    rating: 8,
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    const conversationId = `quiet-conversation-${suffix}`;
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
          title: "Sydney quiet",
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
          title: "Sydney quiet",
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
      ({ catalog, savedAt, zh }) => {
        if (!sessionStorage.getItem("seeded")) {
          sessionStorage.setItem("seeded", "1");
          localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        }
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
      { catalog, savedAt, zh },
    );
    await page.goto(BASE);
    await page.locator(".workspace-app").waitFor();
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

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
    await page.locator("section.trip-editor").waitFor({ timeout: 8000 });
    const timeline = page.getByRole("region", { name: /^(Trip timeline|行程时间线)$/ });
    await timeline.waitFor({ timeout: 8000 }).catch(() => undefined);
    if (!(await timeline.count())) {
      await page.screenshot({ path: resolve(out, `setup-${suffix}.png`), fullPage: true });
      check(false, `saved Trip fixture opens at ${tag}`, { errors: pageErrors });
      await context.close();
      continue;
    }

    const selectDay = async (day) => {
      await page.locator(`.day-strip__day[data-day="${day}"]`).click();
      await waitUntil(
        async () =>
          (await page.locator('.day-strip__day[aria-selected="true"]').getAttribute("data-day")) ===
          String(day),
        4000,
      );
    };
    const rowOf = (name) => page.locator("li.timeline-stop").filter({ hasText: name }).first();
    const style = (locator, property) =>
      locator.evaluate((node, name) => getComputedStyle(node)[name], property);
    const clear = async (locator, label, states) => {
      const background = await style(locator, "backgroundColor");
      check(CLEAR.includes(background), `${label} has no fill ${states} at ${tag}`, background);
    };
    const editor = page.locator("section.trip-editor");

    await selectDay(1);
    check(
      (await editor.getByText(REMOVED_TAGS).count()) === 0,
      `no Place confirmed or Price needs checking tag on day 1 at ${tag}`,
    );
    check(
      (await rowOf("Alder").locator(".timeline-tag").count()) === 0,
      `a confirmed planned stop has no tag at ${tag}`,
    );
    check(
      !(await rowOf("Alder").innerText()).match(/Planned|待游览/),
      `no Planned tag on a stop at ${tag}`,
    );
    check(
      (await rowOf("Alder").locator(".timeline-row__cost").innerText()).includes("25"),
      `a priced stop shows its price on the right at ${tag}`,
    );
    check(
      (await rowOf("Birch").locator(".timeline-row__cost").innerText()) ===
        (zh ? "价格未知" : "Price unknown"),
      `an unpriced stop shows Price unknown on the right at ${tag}`,
    );
    check(
      (await rowOf("Cedar").locator(".timeline-row__cost").innerText()).includes("40"),
      `a stop whose price needs checking still shows its price at ${tag}`,
    );
    check(
      !(await editor.innerText()).match(SENTENCE),
      `no drag helper sentence under day 1 at ${tag}`,
    );
    const badge = page.getByRole("button", { name: /^(Open items, |待处理事项，)\d+/ });
    check((await badge.count()) === 1, `the Open item badge is present at ${tag}`);
    if (await badge.count()) {
      await badge.click();
      const popover = page.getByRole("dialog", { name: /^(Open items|待处理事项)$/ });
      check(
        (await popover.getByText(/Time conflict|时间冲突/).count()) > 0,
        `the Open item badge lists the time conflict at ${tag}`,
      );
      await page.keyboard.press("Escape");
    }
    const lastChild = await page
      .locator(".timeline-day")
      .last()
      .evaluate((node) => node.lastElementChild?.className ?? "");
    check(
      !/timeline-day__tip/.test(lastChild),
      `the day does not end on a helper sentence at ${tag}`,
      lastChild,
    );
    await page.screenshot({ path: resolve(out, `day-1-${suffix}.png`), fullPage: true });

    const time = rowOf("Alder").locator("button.timeline-stop__time");
    await clear(time, "the time cell", "at rest");
    const restColour = await style(time, "color");
    if (!phone) {
      await time.hover();
      await page.waitForTimeout(500);
      await clear(time, "the time cell", "on hover");
      const hoverColour = await style(time, "color");
      check(hoverColour !== restColour, `the time changes colour on hover at ${tag}`, {
        restColour,
        hoverColour,
      });
      await page.mouse.move(0, 0);
    }
    await time.click();
    await waitUntil(async () => (await time.getAttribute("aria-expanded")) === "true", 3000);
    await page.waitForTimeout(500);
    await clear(time, "the time cell", "while its popover is open");
    const openColour = await style(time, "color");
    check(
      openColour !== restColour,
      `the time changes colour while its popover is open at ${tag}`,
      {
        restColour,
        openColour,
      },
    );
    await page.screenshot({ path: resolve(out, `time-open-${suffix}.png`), fullPage: true });
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);

    const other = rowOf("Cedar").locator("button.timeline-stop__time");
    await other.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const focused = await other.evaluate((node) => node === document.activeElement);
    const ring = await other.evaluate((node) => {
      const styles = getComputedStyle(node);
      return {
        outlineStyle: styles.outlineStyle,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow,
        focusVisible: node.matches(":focus-visible"),
      };
    });
    check(focused && ring.focusVisible, `keyboard focus lands on a time at ${tag}`, ring);
    check(
      (ring.outlineStyle !== "none" && ring.outlineWidth !== "0px") || ring.boxShadow !== "none",
      `a focused time shows a focus ring at ${tag}`,
      ring,
    );
    await clear(other, "the focused time cell", "");

    const flight = timeline.locator(".timeline-fixed--flight .timeline-fixed__icon").first();
    check((await flight.count()) === 1, `the flight row renders at ${tag}`);
    await clear(flight, "the flight icon", "");
    const flightBorder = await style(flight, "borderTopWidth");
    check(flightBorder === "0px", `the flight icon has no ring at ${tag}`, flightBorder);
    const stay = timeline.locator(".timeline-row__node.timeline-fixed__icon").nth(1);
    if (await stay.count()) await clear(stay, "the stay icon", "");

    const marker = rowOf("Alder").locator(".timeline-stop__node");
    const markerFill = await style(marker, "backgroundColor");
    check(
      !CLEAR.includes(markerFill),
      `the numbered stop marker keeps its fill at ${tag}`,
      markerFill,
    );

    await selectDay(2);
    check(
      (await editor.getByText(REMOVED_TAGS).count()) === 0,
      `no removed tag on day 2 at ${tag}`,
    );
    check(
      (await rowOf("Dune").locator("button.timeline-stop__time").innerText()).includes("—"),
      `a stop with no time shows a dash at ${tag}`,
    );
    check(
      !(await editor.innerText()).match(SENTENCE),
      `no drag helper sentence under day 2 at ${tag}`,
    );
    await clear(rowOf("Dune").locator("button.timeline-stop__time"), "the empty time cell", "");
    await page.screenshot({ path: resolve(out, `day-2-${suffix}.png`), fullPage: true });

    const ideaNode = page.locator(".timeline-stop__node--idea").first();
    if (await ideaNode.count()) await clear(ideaNode, "the idea icon", "");
    check(pageErrors.length === 0, `no page errors at ${tag}`, pageErrors);
    await context.close();
  }
} catch (error) {
  check(false, "quiet stop rows workflow completed without an exception", String(error));
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
