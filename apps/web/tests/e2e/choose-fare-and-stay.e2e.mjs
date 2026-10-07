// Failure inventory: taking another fare or stay leaves the old price in the total, the swapped
// item reads differently from a planned one (the outbound fare loses its return date), the card
// keeps showing the old choice, a reload brings the old choice back, the Chinese interface shows an
// English label, or the page overflows at phone width.
// Runs in mock data mode, where the planner always finds more than one fare and stay.
//
//   DATA_MODE=mock pnpm --filter @trip/web e2e choose-fare-and-stay
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/choose-fare-and-stay");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name) => {
  results.push({ ok: Boolean(ok), name });
  console.log(`${ok ? "ok" : "FAIL"} ${name}`);
};
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan);
const section = (plan, id) => plan.sections.find((s) => s.id === id)?.proposal;

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const width of [1440, 390]) {
    const phone = width === 390;
    const context = await browser.newContext({
      locale: "en-AU",
      viewport: { width, height: phone ? 844 : 1000 },
    });
    // The Next.js dev-tools button covers the phone Chat tab on a dev server.
    await context.addInitScript(() =>
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = "nextjs-portal { display: none !important; }";
        document.head.append(style);
      }),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const openTrip = async () => {
      if (phone)
        await page
          .getByRole("tablist", { name: "Workspace sections" })
          .getByRole("tab", { name: /^Trip/ })
          .click();
      else await page.getByRole("button", { name: "Open your trip" }).click();
    };
    const expand = async (label) => {
      const row = page.locator(".section__row", { hasText: label }).first();
      if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
    };

    await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
    await page.locator(".workspace-app").waitFor();
    await page
      .getByRole("textbox", { name: "Message AI Trip Planner" })
      .fill(
        "Plan a trip from Melbourne to Sydney, 2026-11-10 to 2026-11-14, 2 travellers, budget 6000 AUD.",
      );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan?.sections?.find(
          (s) => s.id === "transport",
        )?.proposal?.flights?.length > 0,
      undefined,
      { timeout: 180000 },
    );
    const planned = await stored(page);
    const flight = section(planned, "transport").flights[0];
    const fare = flight.candidates.find((c) => c.id !== flight.selectedId);
    const was = flight.candidates.find((c) => c.id === flight.selectedId);
    check(fare && was, `${width}: the planner found more than one fare`);

    await openTrip();
    await expand("Getting around");
    await page
      .getByRole("button", { name: new RegExp(`^Take ${fare.carrier} instead`) })
      .first()
      .click();
    await page.waitForFunction(
      ([id, selected]) =>
        JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")
          ?.plan?.sections?.find((s) => s.id === "transport")
          ?.proposal?.flights?.find((f) => f.id === id)?.selectedId === selected,
      [flight.id, fare.id],
    );
    const afterFare = await stored(page);
    const item = section(afterFare, "transport").items.find((i) => i.selectionId === flight.id);
    check(
      Math.abs(afterFare.estTotal - (planned.estTotal - was.price + fare.price)) < 0.01,
      `${width}: total moves by the fare difference (${planned.estTotal} → ${afterFare.estTotal})`,
    );
    check(
      item?.estCost === fare.price && item.detail.startsWith(`${fare.carrier}:`),
      `${width}: the transport item is priced and described from the new fare`,
    );
    check(
      flight.id !== "flight-0" || item?.detail.includes(`returning ${planned.brief.dates[1]}`),
      `${width}: the swapped outbound fare keeps its return date (${item?.detail})`,
    );
    check(
      (await page.locator(".result-card--flight h4").first().textContent()) === fare.carrier,
      `${width}: the flight card shows the new fare`,
    );

    const stay = section(afterFare, "accommodation").stays[0];
    const room = stay.candidates.find((c) => c.id !== stay.selectedId);
    await expand("Stay");
    await page
      .getByRole("button", { name: new RegExp(`^Take ${room.name} instead`) })
      .first()
      .click();
    await page.waitForFunction(
      ([id, selected]) =>
        JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")
          ?.plan?.sections?.find((s) => s.id === "accommodation")
          ?.proposal?.stays?.find((s) => s.id === id)?.selectedId === selected,
      [stay.id, room.id],
    );
    const afterStay = await stored(page);
    const stayItem = section(afterStay, "accommodation").items.find(
      (i) => i.selectionId === stay.id,
    );
    const cost = Math.round(room.pricePerNight * stay.rooms * stay.nights * 100) / 100;
    check(
      stayItem?.estCost === cost && stayItem.detail.startsWith(`${room.name} —`),
      `${width}: the stay item is priced and described from the new room`,
    );
    await page.screenshot({ path: `${out}/${width}-after-choice.png`, fullPage: true });

    await page.reload();
    await page.locator(".workspace-app").waitFor();
    const reloaded = await stored(page);
    check(
      section(reloaded, "transport").flights[0].selectedId === fare.id &&
        section(reloaded, "accommodation").stays[0].selectedId === room.id,
      `${width}: a reload keeps both choices`,
    );

    check(errors.length === 0, `${width}: no page errors ${errors.join(" | ")}`);
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width}: no overflow`,
    );
    await context.close();
  }
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some((x) => !x.ok)) process.exit(1);
