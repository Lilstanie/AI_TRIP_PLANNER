import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openTripWorkspace } from "./support/e2e-helpers.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const output = resolve("output/e2e/trip-export");
await mkdir(output, { recursive: true });
const results = [];
const check = (ok, name) => {
  results.push({ name, passed: Boolean(ok) });
  if (!ok) throw new Error(name);
};
const tripId = "export-trip";
const savedAt = "2030-01-01T00:00:00Z";
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
        assumptions: [],
        conflictsWith: [],
        items: [
          {
            id: "1",
            kind: "activity",
            day: 1,
            startTime: "09:00",
            endTime: "10:00",
            location: "Museum, Sydney",
            detail: "Museum",
            note: "Bring tickets; ask, then go\\home",
          },
          { kind: "activity", day: 2, location: "Market", detail: "Market" },
          {
            id: "idea",
            kind: "activity",
            location: "Unscheduled idea",
            detail: "Unscheduled idea",
          },
        ],
      },
    },
    {
      id: "accommodation",
      label: "Stay",
      status: "draft",
      summary: "Hotel",
      estCost: 0,
      proposal: {
        agent: "accommodation",
        summary: "Hotel",
        assumptions: [],
        conflictsWith: [],
        items: [{ kind: "hotel", detail: "Harbour Hotel — 3 nights", day: 1 }],
        stays: [
          {
            id: "stay-1",
            city: "Sydney",
            checkIn: "2030-10-01",
            checkOut: "2030-10-04",
            day: 1,
            nights: 3,
            rooms: 1,
            selectedId: "harbour",
            candidates: [
              { id: "cheap", name: "Unchosen Inn", area: "Ultimo", pricePerNight: 90, rating: 7 },
              {
                id: "harbour",
                name: "Harbour Hotel",
                area: "Circular Quay",
                pricePerNight: 200,
                rating: 9,
              },
            ],
          },
        ],
      },
    },
    {
      id: "transport",
      label: "Transport",
      status: "draft",
      summary: "Flights",
      estCost: 900,
      proposal: {
        agent: "transport",
        summary: "Flights",
        assumptions: [],
        conflictsWith: [],
        items: [],
        flights: [
          {
            id: "flight-1",
            from: "MEL",
            to: "SYD",
            depart: "2030-10-01",
            day: 1,
            passengers: 2,
            selectedId: "qantas",
            candidates: [
              { id: "jetstar", carrier: "Unchosen Air", price: 400 },
              {
                id: "qantas",
                carrier: "Qantas",
                price: 900,
                outbound: {
                  segments: [
                    {
                      from: { code: "MEL", name: "Melbourne" },
                      to: { code: "SYD", name: "Sydney" },
                      departsAt: "2030-10-01 07:15",
                      arrivesAt: "2030-10-01 08:45",
                      durationMin: 90,
                      airline: "Qantas",
                      flightNumber: "QF 400",
                    },
                  ],
                  layovers: [],
                  durationMin: 90,
                },
                inbound: {
                  segments: [
                    {
                      from: { code: "SYD", name: "Sydney" },
                      to: { code: "MEL", name: "Melbourne" },
                      departsAt: "2030-10-04 18:30",
                      arrivesAt: "2030-10-04 20:00",
                      durationMin: 90,
                      airline: "Qantas",
                      flightNumber: "QF 481",
                    },
                  ],
                  layovers: [],
                  durationMin: 90,
                },
                roundTrip: true,
              },
            ],
          },
        ],
      },
    },
  ],
};
const snapshot = {
  version: 4,
  id: "export-chat",
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
  activeConversationId: "export-chat",
  activeTripId: tripId,
  conversations: [
    {
      id: "export-chat",
      title: "Sydney trip",
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
      title: "Sydney trip",
      status: "draft",
      updatedAt: savedAt,
      conversationIds: ["export-chat"],
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
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const [width, colorScheme] of [
    [1440, "light"],
    [1440, "dark"],
    [390, "light"],
    [390, "dark"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      colorScheme,
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    await page.addInitScript(
      (value) => localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(value)),
      catalog,
    );
    await page.goto(process.env.BASE_URL ?? "http://localhost:3115");
    await page.locator(".workspace-app").waitFor();
    if (width <= 520) {
      await page.getByRole("tab", { name: "Mine", exact: true }).click();
      await openTripWorkspace(
        page,
        page.locator(".phone-mine .trip-card").filter({ hasText: "Sydney" }).first(),
      );
      await page.getByRole("tab", { name: /^Trip( updated)?$/ }).click();
    } else {
      await page.getByRole("button", { name: /^Trips/ }).click();
      await openTripWorkspace(
        page,
        page.locator(".trips-page .trip-card").filter({ hasText: "Sydney" }).first(),
      );
      const button = page.getByRole("button", { name: "Open your trip", exact: true });
      if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
    }
    await page.getByRole("button", { name: "Itinerary actions" }).click();
    await page.getByRole("menuitem", { name: "Copy trip" }).click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    check(
      text.includes("2030-10-03 · Day 3\nHarbour Hotel"),
      `empty day stay ${width} ${colorScheme}`,
    );
    check(
      text.includes("Museum") &&
        text.includes("09:00") &&
        text.includes("Market") &&
        text.includes("Harbour Hotel") &&
        !text.includes("Unscheduled idea"),
      `copy scheduled stops at ${width}px ${colorScheme}`,
    );
    check(
      text.includes(
        "2030-10-01 · Day 1\n07:15 Flight MEL → SYD · Qantas QF 400\nCheck in: Harbour Hotel",
      ) &&
        text.includes("18:30 Flight SYD → MEL · Qantas QF 481") &&
        !text.includes("Unchosen"),
      `copy selected flights and check-in at ${width}px ${colorScheme}`,
    );
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Itinerary actions" }).click();
    await page.getByRole("menuitem", { name: "Download calendar" }).click();
    const download = await downloaded;
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const ics = Buffer.concat(chunks).toString("utf8");
    const uids = [...ics.matchAll(/^UID:(.+)$/gm)].map((match) => match[1].trim());
    check(
      uids.length === 5 && new Set(uids).size === 5,
      `unique event IDs ${width} ${colorScheme}`,
    );
    check(
      ics.includes("DTSTART:20301001T071500") &&
        ics.includes("DTEND:20301001T084500") &&
        ics.includes("SUMMARY:Flight MEL → SYD · Qantas QF 400") &&
        ics.includes("DTSTART:20301004T183000") &&
        ics.includes("SUMMARY:Flight SYD → MEL · Qantas QF 481") &&
        /DTSTART;VALUE=DATE:20301001\r\nDTEND;VALUE=DATE:20301004\r\nSUMMARY:Harbour Hotel/.test(
          ics,
        ) &&
        !ics.includes("Unchosen"),
      `calendar holds the selected flights and the stay at ${width}px ${colorScheme}`,
    );
    check(
      download.suggestedFilename().endsWith(".ics") &&
        ics.includes("BEGIN:VCALENDAR") &&
        ics.includes("20301001T090000") &&
        ics.includes("Museum") &&
        ics.includes("DTSTART;VALUE=DATE:20301002") &&
        ics.includes("DTEND;VALUE=DATE:20301003") &&
        ics.includes("LOCATION:Museum\\, Sydney") &&
        ics.includes("DESCRIPTION:Bring tickets\\; ask\\, then go\\\\home") &&
        !ics.includes("Unscheduled idea"),
      `calendar events at ${width}px ${colorScheme}`,
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `no horizontal overflow at ${width}px ${colorScheme}`,
    );
    await page.screenshot({ path: `${output}/${width}-${colorScheme}.png` });
    await context.close();
  }
} catch (error) {
  results.push({ name: "execution", passed: false, error: String(error) });
} finally {
  await browser.close();
  await writeFile(`${output}/summary.json`, JSON.stringify({ results }, null, 2));
  for (const result of results)
    console.log(
      `${result.passed ? "ok" : "FAIL"} ${result.name}${result.error ? `: ${result.error}` : ""}`,
    );
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}
