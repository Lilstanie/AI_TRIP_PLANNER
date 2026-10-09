// Opt-in live free-service browser check (#277). Never calls Google, a model or Clerk.
// Failure inventory: real tiles fail; places cannot save; Google snapshot loses location;
// live OSM details or route fail; phone map cannot be reached; sources disappear.
// requires-env: RUN_LIVE_MAP_CHECK
// WEB_MAPS_PROVIDER=osm USE_MOCK_TOOLS=true RUN_LIVE_MAP_CHECK=1 pnpm --filter @trip/web e2e map-fallback-live
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const BASE = process.env.BASE_URL;
const OUT = resolve("output/playwright/map-fallback-live/after");
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHANNEL || "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const calls = [],
  errors = [],
  checks = [];
const check = (ok, message) => {
  checks.push({ ok, message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
let plan;
try {
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", async (r) => {
    if (/tiles.openfreemap|api\/places|api\/trip\/preview-edit/.test(r.url()))
      calls.push({ url: r.url().split("?")[0], status: r.status() });
    if (r.url().endsWith("/api/trip/preview-edit")) {
      const body = await r.json().catch(() => ({}));
      if (body.plan) plan = body.plan;
    }
  });
  await page.route("**/api/data-mode", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({
      response,
      json: {
        ...json,
        configured: "live",
        providers: { ...json.providers, webMapsProvider: "osm" },
      },
    });
  });
  await page.route("**/api/chat", async (route) => {
    const response = await route.fetch({
      headers: { ...route.request().headers(), "x-trip-data-mode": "mock" },
    });
    const text = (await response.text())
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        const frame = JSON.parse(line);
        const section = frame.response?.plan?.sections.find((s) => s.id === "itinerary");
        if (!section?.proposal) return line;
        const names = ["Kyoto Station", "To-ji Temple", "Kiyomizu-dera", "Nishiki Market"];
        const activities = section.proposal.items.filter((i) => i.kind === "activity").slice(0, 4);
        section.proposal.items = section.proposal.items.filter(
          (i) => i.kind !== "activity" || activities.includes(i),
        );
        activities.forEach((s, i) => {
          Object.assign(s, {
            day: 1,
            startTime: `${String(9 + i * 3).padStart(2, "0")}:00`,
            endTime: `${String(10 + i * 3).padStart(2, "0")}:00`,
            location: names[i],
            detail: names[i],
          });
          delete s.placeId;
          delete s.arriveBy;
          if (!i) {
            s.placeId = "google-saved-kyoto-station";
            s.savedPlace = { name: names[i], location: { latitude: 34.9858, longitude: 135.7588 } };
          }
        });
        frame.response.plan.brief.destination = "Kyoto";
        return JSON.stringify(frame);
      })
      .join("\n");
    await route.fulfill({ response, body: text });
  });
  await page.goto(BASE);
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 120000 });
  await page.getByRole("button", { name: "Open your trip" }).click();
  for (let n = 0; n < 90; n++) {
    const stops =
      plan?.sections
        .find((s) => s.id === "itinerary")
        ?.proposal?.items.filter((i) => i.kind === "activity") || [];
    if (stops.filter((s) => s.placeId?.startsWith("osm:")).length >= 3) break;
    await page.waitForTimeout(1000);
  }
  const stops =
    plan?.sections
      .find((s) => s.id === "itinerary")
      ?.proposal?.items.filter((i) => i.kind === "activity") || [];
  check(
    stops.some((s) => s.savedPlace?.name === "Kyoto Station"),
    "saved Google coordinates survive live OSM mode",
  );
  check(
    stops.filter((s) => s.placeId?.startsWith("osm:")).length >= 3,
    "three new places save through live free providers",
  );
  await page.locator(".timeline-stop__head > button").nth(1).click();
  await page.locator(".stop-place-card").waitFor();
  await page.screenshot({ animations: "disabled", path: `${OUT}/card-desktop.png` });
  await page
    .locator(".stop-place-card")
    .getByRole("button", { name: "Close place details" })
    .click();
  await page.getByRole("button", { name: "Close your trip" }).click();
  await page.locator(".google-map[data-provider=osm] canvas").waitFor();
  await page.locator(".google-map[data-map-ready=true]").waitFor({ timeout: 60000 });
  const osm = stops.find((s) => s.placeId?.startsWith("osm:"));
  if (osm) {
    const response = await page.request.post(`${BASE}/api/routes/from-location`, {
      headers: { "x-trip-data-mode": "live" },
      data: { latitude: 34.9858, longitude: 135.7588, placeId: osm.placeId, mode: "WALK" },
    });
    const answer = await response.json();
    check(
      answer.status === "ok" && answer.source === "osrm",
      "live OSRM walking route has an observed duration",
    );
    calls.push({ operation: "live-walk", status: response.status(), answer });
  }
  check(
    calls.some((c) => c.url.includes("tiles.openfreemap") && c.status === 200),
    "real OpenFreeMap style or tiles loaded",
  );
  await page.screenshot({ animations: "disabled", path: `${OUT}/map-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: /^Map/ }).click();
  await page.waitForTimeout(800);
  check(
    await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
    "live phone map has no horizontal overflow",
  );
  await page.screenshot({ animations: "disabled", path: `${OUT}/map-phone.png` });
  check(errors.length === 0, "no page errors");
} finally {
  writeFileSync(`${OUT}/summary.json`, JSON.stringify({ checks, errors, calls, plan }, null, 2));
  await browser.close();
}
process.exitCode = checks.some((c) => !c.ok) ? 1 : 0;
