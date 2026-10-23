import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/one-day-trip", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

async function planTurn(name, brief) {
  const response = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify({
      tripId: name,
      mode: "plan",
      message: "Plan my trip",
      brief: { tripId: name, userId: "e2e", groupSize: 1, budgetTotal: 400, ...brief },
    }),
  });
  const text = await response.text();
  writeFileSync(`${OUT}/${name}.ndjson`, text);
  const events = text
    .trim()
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const plan = events.findLast((event) => event.type === "complete")?.response?.plan;
  return { status: response.status, events, plan, last: events.at(-1) };
}

const section = (plan, id) => plan?.sections.find((entry) => entry.id === id)?.proposal;
const days = (plan) => [
  ...new Set((section(plan, "itinerary")?.items ?? []).map((item) => item.day)),
];
const stays = (plan) => section(plan, "accommodation")?.stays ?? [];

try {
  const day = await planTurn("one-day-api", {
    destination: "Sydney",
    dates: ["2026-12-14", "2026-12-14"],
    noAccommodation: true,
  });
  check(day.plan, "a one-destination day trip without accommodation plans", day.last);
  check(
    JSON.stringify(days(day.plan)) === "[1]",
    "every stop of the day trip is on day 1",
    days(day.plan),
  );
  check(
    day.plan && !section(day.plan, "accommodation"),
    "the day trip has no accommodation section",
    day.plan?.sections.map((entry) => entry.id),
  );

  const keep = await planTurn("one-day-keep-stay", {
    destination: "Sydney",
    dates: ["2026-12-14", "2026-12-14"],
    noAccommodation: false,
  });
  check(!keep.plan, "a same-day trip that keeps accommodation is refused", keep.last);

  const two = await planTurn("one-day-two-cities", {
    destination: "Sydney & Wollongong",
    dates: ["2026-12-14", "2026-12-14"],
    noAccommodation: true,
  });
  check(!two.plan, "two destinations on one day are refused", two.last);

  const backwards = await planTurn("one-day-backwards", {
    destination: "Sydney",
    dates: ["2026-12-14", "2026-12-13"],
    noAccommodation: true,
  });
  check(!backwards.plan, "an end date before the start is refused", backwards.last);

  const three = await planTurn("three-day-control", {
    destination: "Sydney",
    dates: ["2026-12-14", "2026-12-16"],
  });
  check(
    three.plan && days(three.plan).length === 3 && stays(three.plan).length > 0,
    "a 3-day trip keeps three days and a stay",
    { days: days(three.plan), stays: stays(three.plan).length },
  );

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
  });
  try {
    for (const language of ["en", "zh"]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
        locale: language === "zh" ? "zh-CN" : "en-AU",
      });
      await context.addInitScript((language) => {
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({
            version: 1,
            travel: { homeCity: "", preferences: [] },
            language,
            dataMode: "mock",
            appearance: "system",
            updatedAt: "2026-10-23T00:00:00Z",
          }),
        );
      }, language);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.locator(".workspace-app").waitFor();
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const notNow = page.getByRole("button", { name: language === "zh" ? "暂不" : "Not now" });
      await notNow.waitFor({ timeout: 5000 }).then(
        () => notNow.click(),
        () => {},
      );
      const turn = page.waitForResponse((response) => response.url().endsWith("/api/chat"));
      await page
        .getByRole("textbox", {
          name: language === "zh" ? /AI Trip Planner|消息/ : "Message AI Trip Planner",
        })
        .fill("1 day in Sydney from 14 Dec 2026 for 1 adult, budget AUD 200");
      await page.keyboard.press("Enter");
      const body = await (await turn).text();
      writeFileSync(`${OUT}/ui-${language}.ndjson`, body);
      await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
      const planned = body
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .findLast((event) => event.type === "complete")?.response?.plan;
      check(planned, `${language}: "1 day in Sydney" plans without another question`, {
        reply: await page.locator(".msg-item--agent .msg-item__body").last().innerText(),
      });
      check(
        planned &&
          JSON.stringify(planned.brief.dates) === '["2026-12-14","2026-12-14"]' &&
          planned.brief.noAccommodation === true,
        `${language}: the planned trip is 14 Dec only, without accommodation`,
        planned?.brief,
      );
      check(
        planned && JSON.stringify(days(planned)) === "[1]",
        `${language}: the UI plan has stops on day 1 only`,
        days(planned),
      );
      const facts = await page
        .locator(".workspace-topbar, .trip-facts, header")
        .first()
        .innerText();
      check(
        language === "zh" ? facts.includes("1 天") : /\b1 day\b/.test(facts),
        `${language}: the trip details say one day`,
        facts.replace(/\s+/g, " ").slice(0, 200),
      );
      await page.screenshot({ path: `${OUT}/1440-${language}.png` });
      check(errors.length === 0, `${language}: browser has no page errors`, errors);
      await context.close();
    }
  } finally {
    await browser.close();
  }
} catch (error) {
  check(false, "journey completes", String(error).slice(0, 400));
} finally {
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
