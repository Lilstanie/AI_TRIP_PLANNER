// requires-env: STAY_STUB_PORT, NOMINATIM_BASE_URL, OVERPASS_BASE_URL, OSRM_BASE_URL, PHOTON_BASE_URL
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PORT = Number(process.env.STAY_STUB_PORT);
const OUT = resolve("output/playwright/stay-unavailable", process.env.LABEL ?? "run");
const MESSAGE = "Plan 4 days in Lisbon from Sydney, 2 people, budget 6000 AUD, from 2027-03-10";
mkdirSync(OUT, { recursive: true });

const checks = [];
const check = (ok, name, observed) => {
  checks.push({ ok: Boolean(ok), name, ...(observed === undefined ? {} : { observed }) });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const stubbed = `http://127.0.0.1:${PORT}`;
const environment = {
  USE_MOCK_TOOLS: process.env.USE_MOCK_TOOLS,
  MAPS_PROVIDER: process.env.MAPS_PROVIDER,
  SERPAPI_KEY: process.env.SERPAPI_KEY ? "set" : "absent",
  MAPS_API_KEY: process.env.MAPS_API_KEY ? "set" : "absent",
};
if (
  !PORT ||
  environment.USE_MOCK_TOOLS !== "false" ||
  environment.MAPS_PROVIDER !== "osm" ||
  environment.SERPAPI_KEY !== "absent" ||
  environment.MAPS_API_KEY !== "absent" ||
  ["NOMINATIM_BASE_URL", "OVERPASS_BASE_URL", "OSRM_BASE_URL", "PHOTON_BASE_URL"].some(
    (name) => process.env[name] !== stubbed,
  )
) {
  throw new Error(
    `Run with USE_MOCK_TOOLS=false MAPS_PROVIDER=osm, no SERPAPI_KEY or MAPS_API_KEY, and every OSM base URL set to ${stubbed}`,
  );
}

const CENTRES = {
  lisbon: [38.7223, -9.1393],
  tokyo: [35.6762, 139.6503],
  kyoto: [35.0116, 135.7681],
};
const SIGHTS = {
  lisbon: [
    "Torre de Belém",
    "Mosteiro dos Jerónimos",
    "Castelo de São Jorge",
    "Museu Calouste Gulbenkian",
    "Oceanário de Lisboa",
    "Praça do Comércio",
    "Museu Nacional do Azulejo",
    "Elevador de Santa Justa",
    "Padrão dos Descobrimentos",
    "Sé de Lisboa",
  ],
};
const cityOf = (text) =>
  Object.keys(CENTRES).find((city) => text.toLowerCase().includes(city)) ?? "lisbon";
const near = (city, index) => {
  const [lat, lon] = CENTRES[city];
  return [lat + ((index % 5) - 2) * 0.006, lon + (Math.floor(index / 5) - 1) * 0.008];
};

const calls = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, stubbed);
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    calls.push({ method: req.method, path: url.pathname });
    res.setHeader("content-type", "application/json");
    const query = url.searchParams.get("q") ?? decodeURIComponent(body);
    const city = cityOf(query);
    const [lat, lon] = CENTRES[city];
    if (url.pathname === "/search") {
      const name = query.split(",")[0].trim();
      return res.end(
        JSON.stringify([
          {
            osm_type: "node",
            osm_id: 1000 + calls.length,
            lat: String(lat),
            lon: String(lon),
            boundingbox: [lat - 0.08, lat + 0.08, lon - 0.1, lon + 0.1].map(String),
            name,
            display_name: `${name}, ${city}`,
            type: "attraction",
            address: { city },
          },
        ]),
      );
    }
    if (url.pathname === "/interpreter") {
      const restaurants = /amenity"~"\^\(restaurant/.test(query);
      const names = restaurants
        ? Array.from({ length: 8 }, (_, index) => `Tasca ${index + 1}`)
        : (SIGHTS[city] ??
          Array.from({ length: 10 }, (_, index) => `${city} landmark ${index + 1}`));
      return res.end(
        JSON.stringify({
          elements: names.map((name, index) => {
            const [y, x] = near(city, index);
            return {
              type: "node",
              id: (restaurants ? 9000 : 5000) + index,
              lat: y,
              lon: x,
              tags: {
                name,
                ...(restaurants
                  ? { amenity: "restaurant" }
                  : {
                      tourism: "attraction",
                      wikidata: `Q${100 + index}`,
                      wikipedia: `pt:${name}`,
                    }),
              },
            };
          }),
        }),
      );
    }
    if (url.pathname.startsWith("/route/")) {
      return res.end(
        JSON.stringify({ code: "Ok", routes: [{ duration: 900, distance: 2400, geometry: "" }] }),
      );
    }
    if (url.pathname === "/api/" || url.pathname === "/api") {
      return res.end(
        JSON.stringify({
          features: [
            {
              geometry: { coordinates: [lon, lat] },
              properties: { osm_type: "N", osm_id: 1, name: query.split(",")[0].trim() },
            },
          ],
        }),
      );
    }
    if (url.pathname === "/lookup" || url.pathname === "/reverse")
      return res.end(JSON.stringify([]));
    res.statusCode = 503;
    res.end("{}");
  });
});
await new Promise((done) => server.listen(PORT, "127.0.0.1", done));

const settings = (dataMode) => ({
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode,
  appearance: "light",
  language: "en",
  displayCurrency: "AUD",
  updatedAt: "2026-11-04T00:00:00Z",
});

const readFrames = (text) =>
  text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

let browser;
let failure;
const evidence = {};
try {
  browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
  });
  await context.addInitScript((value) => {
    if (!localStorage.getItem("trip.settings.v1"))
      localStorage.setItem("trip.settings.v1", JSON.stringify(value));
  }, settings("live"));
  await context.route(/^(?!http:\/\/localhost|http:\/\/127\.0\.0\.1).*/, (route) => route.abort());
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

  const toggle = page.locator("button.data-mode").first();
  await toggle.waitFor({ timeout: 60_000 });
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
  await page.locator('button.data-mode[aria-pressed="true"]').first().waitFor({ timeout: 10_000 });
  check(
    /^Live data/.test((await toggle.innerText()).trim()),
    "the workspace is switched to Live data",
  );
  const chatResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/chat") && response.request().method() === "POST",
    { timeout: 300_000 },
  );
  const composer = page.locator(".composer__input");
  await composer.waitFor({ timeout: 60_000 });
  await composer.fill(MESSAGE);
  await composer.press("Enter");
  const response = await chatResponse;
  const frames = readFrames(await response.text());
  writeFileSync(
    resolve(OUT, "chat.ndjson"),
    frames.map((frame) => JSON.stringify(frame)).join("\n"),
  );
  const requested = (await response.request().allHeaders())["x-trip-data-mode"];
  check(requested === "live", "the workspace asks for Live data", requested);
  const complete = frames.find((frame) => frame.type === "complete");
  const errorFrame = frames.find((frame) => frame.type === "error");
  check(complete && !errorFrame, "the turn completes instead of failing", errorFrame?.error);
  const plan = complete?.response?.plan ?? complete?.plan;
  if (!plan) throw new Error("no plan in the completed turn");
  writeFileSync(resolve(OUT, "plan.json"), JSON.stringify(plan, null, 2));

  const failed = frames
    .filter((frame) => frame.type === "agent_failed")
    .map((frame) => frame.agent);
  check(failed.length === 0, "no specialist fails", failed);
  const section = (id) => plan.sections.find((entry) => entry.id === id);
  const stay = section("accommodation");
  const stayItems = stay?.proposal?.items ?? [];
  evidence.sections = plan.sections.map((entry) => ({
    id: entry.id,
    estCost: entry.estCost,
    source: entry.proposal?.source?.kind,
    summary: entry.summary,
  }));
  check(
    ["transport", "itinerary", "dining", "destination-guide"].every((id) => section(id)?.proposal),
    "the other specialists' sections still plan",
    evidence.sections.map((entry) => `${entry.id}:${entry.source}`),
  );
  check(
    stay?.proposal?.source?.kind === "unavailable",
    "the stay section reports source unavailable",
    stay?.proposal?.source,
  );
  check(
    stayItems.length === 1 &&
      stayItems[0].kind === "hotel" &&
      stayItems[0].day === 1 &&
      stayItems[0].estCost === undefined &&
      /2027-03-10 to 2027-03-13/.test(stayItems[0].detail) &&
      /3 nights/.test(stayItems[0].detail),
    "the Lisbon nights are one unpriced stay row with dates and nights",
    stayItems,
  );
  check(
    stay?.estCost === 0 && (stay?.proposal?.stays ?? []).length === 0,
    "no stay price or candidate is invented",
    { estCost: stay?.estCost, stays: stay?.proposal?.stays },
  );
  check(
    (plan.conflicts ?? []).some((conflict) =>
      /Stay provider unavailable, so the stay in Lisbon from 2027-03-10 until 2027-03-13 remains unpriced\./.test(
        conflict.reason,
      ),
    ),
    "the plan keeps an open stay conflict",
    plan.conflicts,
  );

  const reply = page.locator(".msg-item--agent .msg-item__body").last();
  await reply.waitFor({ timeout: 60_000 });
  check(
    !(await page.getByText("Unable to update this trip").count()),
    "the chat shows no update failure",
  );
  const openTrip = page.getByRole("button", { name: "Open your trip" });
  if (await openTrip.count()) await openTrip.first().click();
  await page.locator(".trip-panel").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);

  const budget = page.locator(".trip-panel__budget-summary").first();
  const budgetLine = (await budget.locator("summary").innerText()).replace(/\s+/g, " ");
  check(
    /\d+ unpriced/.test(budgetLine) && /unpriced costs not counted/.test(budgetLine),
    "the budget card says unpriced costs are not counted",
    budgetLine,
  );
  await budget.locator("summary").click();
  const accommodationRow = (
    await budget.locator(".trip-panel__budget-breakdown li").first().innerText()
  ).replace(/\s+/g, " ");
  check(
    /Accommodation\s*Not costed/.test(accommodationRow),
    "Accommodation reads Not costed",
    accommodationRow,
  );
  const conflictText = await budget
    .locator(".trip-panel__conflicts")
    .innerText()
    .catch(() => "");
  check(
    /No stay could be searched in Lisbon for 2027-03-10 to 2027-03-13/.test(conflictText),
    "the budget card explains why the stay is not priced",
    conflictText,
  );
  await page.screenshot({ path: resolve(OUT, "budget-card.png") });

  const stayRow = page.locator(".timeline-fixed--stay").first();
  await stayRow.scrollIntoViewIfNeeded().catch(() => undefined);
  const stayRowParts = {
    title: (
      await stayRow
        .locator(".timeline-fixed__title")
        .innerText()
        .catch(() => "")
    ).trim(),
    meta: (
      await stayRow
        .locator(".timeline-row__meta")
        .innerText()
        .catch(() => "")
    ).trim(),
    cost: (
      await stayRow
        .locator(".timeline-row__cost")
        .innerText()
        .catch(() => "")
    ).trim(),
  };
  check(
    /Lisbon stay$/.test(stayRowParts.title) &&
      /3 nights/.test(stayRowParts.meta) &&
      stayRowParts.cost === "Price unknown",
    "the Stays row shows the city and nights with no price",
    stayRowParts,
  );
  await page.screenshot({ path: resolve(OUT, "stays-row.png") });

  const badge = page.locator(".open-items__badge").first();
  await badge.click();
  const popover = page.getByRole("dialog", { name: "Open items" });
  await popover.waitFor();
  const groupText = (await popover.innerText()).replace(/\s+/g, " ");
  check(
    /Unpriced stay · 1/.test(groupText) &&
      (await popover.getByRole("button", { name: "Unpriced stay: Lisbon stay" }).count()) === 1,
    "To check lists the unpriced Lisbon stay",
    groupText,
  );
  await page.screenshot({ path: resolve(OUT, "to-check.png") });
  await page.keyboard.press("Escape");

  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Trips/ })
    .click();
  await page.locator(".trip-cards .trip-card").first().click();
  await page.locator(".trip-home").waitFor();
  await page.locator('[data-card="calendar"]').click();
  const calendar = page.getByRole("dialog", { name: "Calendar", exact: true });
  await calendar.locator(".trip-home-calendar__date").first().waitFor();
  const bars = await calendar
    .locator(".trip-home-calendar__stay")
    .evaluateAll((nodes) => nodes.map((node) => node.textContent.replace(/\s+/g, " ").trim()));
  check(
    bars.some((bar) => /Lisbon stay/.test(bar) && /3 nights/.test(bar)),
    "the calendar stay bar covers the unpriced nights",
    bars,
  );
  await page.screenshot({ path: resolve(OUT, "calendar.png") });
  check(pageErrors.length === 0, "the page raises no errors", pageErrors);

  const lab = await fetch(`${BASE}/api/agent-lab/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenarioId: "kyoto-multi-city-tight-budget",
      strategyId: "multi-agent-no-revision",
      dataMode: "live",
    }),
  });
  const labFrames = readFrames(await lab.text());
  const artifact = labFrames.find((frame) => frame.type === "complete")?.artifact;
  writeFileSync(
    resolve(OUT, "agent-lab.json"),
    JSON.stringify(artifact ?? labFrames.at(-1), null, 2),
  );
  const metrics = artifact?.metrics;
  const labStay = artifact?.plan?.sections.find((entry) => entry.id === "accommodation");
  const stayChecks = (metrics?.checks ?? []).filter((entry) =>
    ["stay-nights", "trip-dates"].includes(entry.id),
  );
  evidence.agentLab = {
    status: lab.status,
    failedAgents: metrics?.failedAgents,
    groundedSections: metrics?.groundedSections,
    unresolvedConflicts: metrics?.unresolvedConflicts,
    stayChecks,
    staySource: labStay?.proposal?.source?.kind,
  };
  check(
    artifact?.status === "completed" &&
      metrics?.failedAgents === 0 &&
      labStay?.proposal?.source?.kind === "unavailable" &&
      metrics.groundedSections < artifact.plan.sections.length &&
      metrics.unresolvedConflicts >= 1,
    "Agent Lab completes, does not count the stay as grounded, and keeps the conflict",
    evidence.agentLab,
  );
  check(
    stayChecks.length === 2 && stayChecks.every((entry) => entry.passed),
    "Agent Lab stay-date checks still read the unpriced stay",
    stayChecks,
  );
} catch (error) {
  failure = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.log(`FAIL ${failure}`);
} finally {
  await browser?.close();
  server.close();
  const passed = !failure && checks.length > 0 && checks.every((entry) => entry.ok);
  writeFileSync(
    resolve(OUT, "summary.json"),
    JSON.stringify(
      {
        passed,
        failure: failure ?? null,
        message: MESSAGE,
        environment,
        stubCalls: calls.length,
        checks,
        evidence,
      },
      null,
      2,
    ),
  );
  console.log(`${passed ? "PASS" : "FAIL"} stay-unavailable: ${OUT}/summary.json`);
  process.exitCode = passed ? 0 : 1;
}
