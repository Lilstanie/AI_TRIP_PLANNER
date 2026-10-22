import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/calendar-trip-label-span", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const savedAt = "2026-12-01T00:00:00Z";
const makeTrip = (id, destination, dates) => {
  const title = `Trip to ${destination}`;
  const brief = {
    tripId: id,
    userId: "local",
    destination,
    dates,
    groupSize: 2,
    budgetTotal: 4000,
  };
  const snapshot = {
    version: 3,
    id,
    savedAt,
    plan: {
      tripId: id,
      brief,
      round: 1,
      budgetTotal: 4000,
      estTotal: 0,
      overrunPct: -100,
      sections: [],
    },
    draft: {
      destination,
      origin: "",
      start: dates[0],
      end: dates[1],
      groupSize: "2",
      budgetTotal: "4000",
      preferences: [],
      nationality: "",
      roomAllocation: "shared",
      minRating: "0",
      freeCancellation: false,
    },
    messages: [],
    input: "",
  };
  return {
    trip: {
      id: `trip:${id}`,
      title,
      status: "draft",
      updatedAt: savedAt,
      conversationIds: [`conversation:${id}`],
      snapshot,
    },
    conversation: {
      id: `conversation:${id}`,
      title,
      updatedAt: savedAt,
      tripId: `trip:${id}`,
      messages: [],
      input: "",
      snapshot,
    },
  };
};
const entries = [
  makeTrip("coast", "Sydney & Wollongong", ["2026-12-21", "2026-12-25"]),
  makeTrip("hobart", "Hobart", ["2026-12-05", "2026-12-08"]),
];
const catalog = {
  version: 4,
  activeTripId: entries[0].trip.id,
  activeConversationId: entries[0].conversation.id,
  trips: entries.map(({ trip }) => trip),
  conversations: entries.map(({ conversation }) => conversation),
  layout: {
    sidebar: { collapsed: false },
    preferences: { open: false, width: 280 },
    trip: { open: false, width: 340 },
    view: "chat",
    editorView: "map",
  },
};
const settings = {
  version: 1,
  travel: { homeCity: "", preferences: [] },
  language: "en",
  dataMode: "mock",
  appearance: "system",
  updatedAt: savedAt,
};

const measure = (destination) =>
  `(() => {
    const bars = [...document.querySelectorAll(".trip-calendar__trip")].filter((node) =>
      node.getAttribute("aria-label").startsWith("Trip to ${destination}:"),
    );
    return bars
      .filter((bar) => bar.querySelector(".trip-calendar__visible-label"))
      .map((bar) => {
        const label = bar.querySelector(".trip-calendar__visible-label");
        label.scrollIntoView({ block: "center" });
        const row = bar.closest(".trip-calendar__week");
        const inRow = bars.filter((other) => other.closest(".trip-calendar__week") === row);
        const box = label.getBoundingClientRect();
        const first = bar.getBoundingClientRect();
        const last = inRow.at(-1).getBoundingClientRect();
        const probe = document.elementFromPoint(box.right - 4, box.top + box.height / 2);
        return {
          text: label.textContent,
          days: inRow.length,
          left: Math.round(box.left - first.left),
          right: Math.round(last.right - box.right),
          width: Math.round(box.width),
          cell: Math.round(first.width),
          clipped: label.scrollWidth > label.clientWidth + 1,
          ellipsis: getComputedStyle(label).textOverflow,
          onTop: label.contains(probe),
        };
      });
  })()`;

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const width of [1440, 390]) {
    const phone = width <= 520;
    const context = await browser.newContext({
      viewport: { width, height: phone ? 844 : 1000 },
      isMobile: phone,
      hasTouch: phone,
      reducedMotion: "reduce",
      locale: "en-AU",
      timezoneId: "Australia/Sydney",
    });
    await context.addInitScript(
      ({ catalog, settings }) => {
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
      },
      { catalog, settings },
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.clock.install({ time: new Date("2026-12-10T01:00:00Z") });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.locator(".workspace-app").waitFor();
    if (phone) await page.locator(".phone-tabbar [role=tab]").nth(3).click();
    else await page.getByRole("button", { name: /^Trips/ }).click();
    await page.getByRole("tab", { name: "Calendar", exact: true }).click();
    await page.locator(".trip-calendar__visible-label").first().waitFor();

    const [coast] = await page.evaluate(measure("Sydney & Wollongong"));
    check(
      coast && /Sydney & Wollongong/.test(coast.text) && !coast.clipped && coast.width > coast.cell,
      `${width}px five-day bar shows its whole name across the bar`,
      coast,
    );
    check(
      coast && coast.left >= -1 && coast.right >= -1 && coast.onTop,
      `${width}px label stays inside its bar and is not painted over`,
      coast,
    );
    check(coast?.ellipsis === "ellipsis", `${width}px label keeps its ellipsis`, coast?.ellipsis);

    const hobart = await page.evaluate(measure("Hobart"));
    check(
      hobart.length === 2 &&
        hobart.every((row) => row.days === 2 && row.left >= -1 && row.right >= -1 && row.onTop),
      `${width}px trip across two weeks labels each row within that row's days`,
      hobart,
    );
    if (phone) {
      const overflow = await page.evaluate(
        () => document.scrollingElement.scrollWidth - window.innerWidth,
      );
      check(overflow <= 0, `${width}px page has no horizontal overflow`, overflow);
    }
    await page.screenshot({ path: `${OUT}/calendar-${width}.png`, fullPage: true });
    check(errors.length === 0, `${width}px browser has no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
