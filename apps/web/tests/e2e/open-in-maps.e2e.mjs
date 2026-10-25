import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, placeFor, planSuggestedTrip, settle } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/open-in-maps");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/search", async (route) => {
    const { text } = route.request().postDataJSON();
    return route.fulfill({ json: { places: [placeFor(text)] } });
  });
  await page.route("**/api/places/details", async (route) => {
    const { placeId } = route.request().postDataJSON();
    return route.fulfill({ json: { place: { ...placeFor(placeId), id: placeId } } });
  });
  await context.route("https://www.google.com/maps/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Maps</title>" }),
  );
  await openMockWorkspace(page, BASE);
  await planSuggestedTrip(page);
  const timeline = page.getByRole("region", { name: "Trip timeline" });
  const stop = timeline.locator(".timeline-stop:not(.timeline-stop--idea)").first();
  await stop.waitFor();
  await settle(page, 1500);
  await stop.getByRole("button", { name: /^Actions for / }).click();
  await timeline.getByRole("menuitem", { name: "Replace place", exact: true }).click();
  const search = stop.getByRole("searchbox");
  await search.fill("Sydney Opera House");
  await search.press("Enter");
  await stop.getByRole("button", { name: "Use Sydney Opera House" }).click();
  await stop.getByText("Place confirmed").waitFor();
  await stop.getByRole("button", { name: /^Actions for / }).click();
  const item = timeline.getByRole("menuitem", { name: "Open in Maps", exact: true });
  const shown = await item.waitFor({ timeout: 5000 }).then(
    () => true,
    () => false,
  );
  await page.screenshot({ path: `${OUT}/stop-menu.png` });
  check(shown, "a stop with a place on the map offers Open in Maps in its ⋮ menu");
  if (shown) {
    const [popup] = await Promise.all([page.waitForEvent("popup"), item.click()]);
    const url = new URL(popup.url());
    check(
      url.hostname === "www.google.com" &&
        url.pathname === "/maps/dir/" &&
        url.searchParams.get("api") === "1" &&
        url.searchParams.get("destination") === "-33.8568,151.2153",
      "Open in Maps opens directions to the stop's coordinates in a new tab",
      popup.url(),
    );
    await popup.close();
  }
  check(errors.length === 0, "no page errors", errors);
  await context.close();
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
