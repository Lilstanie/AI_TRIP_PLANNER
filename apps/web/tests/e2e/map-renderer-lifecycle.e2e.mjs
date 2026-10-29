import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { seedTrip, sydney } from "./phone-map-seed.mjs";
import { installGoogleRendererFixture } from "./google-renderer-fixture.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/map-renderer-lifecycle", process.env.LABEL ?? "after");
mkdirSync(OUT, { recursive: true });
const results = [];
const browser = await chromium.launch({ channel: process.env.CHANNEL ?? "chrome" });
const { catalog, snapshot } = seedTrip();
const items = snapshot.plan.sections[0].proposal.items;
items.push({
  ...items[0],
  id: "second-stop",
  detail: "Museum",
  startTime: "11:00",
  endTime: "12:00",
});
items.forEach((item, index) => {
  item.placeId = `fixture-stop-${index}`;
  item.savedPlace = {
    name: item.detail,
    location: { latitude: -33.86 + index * 0.01, longitude: 151.21 + index * 0.01 },
  };
});
const check = (ok, name, observed) => {
  results.push({ ok: !!ok, name, observed });
  assert.ok(ok, `${name}: ${JSON.stringify(observed)}`);
};

async function open({ width, language, provider, failure }) {
  const context = await browser.newContext({
    viewport: { width, height: width <= 520 ? 844 : 1000 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ catalog, language }) => {
      if (localStorage.getItem("lifecycle-seeded")) return;
      localStorage.setItem("lifecycle-seeded", "1");
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
      localStorage.setItem("trip.locationPrompt", "dismissed");
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "", preferences: [] },
          dataMode: "mock",
          appearance: "light",
          language,
          updatedAt: "2026-10-29T00:00:00Z",
        }),
      );
    },
    { catalog, language },
  );
  await context.addInitScript(installGoogleRendererFixture, { failure });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const origin = new URL(BASE).origin;
  await page.route(/^https?:\/\//, (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    return route.abort();
  });
  await page.route("**/maps/api/js?*", (route) => {
    return failure === "script"
      ? route.abort()
      : route.fulfill({
          contentType: "text/javascript",
          body: failure === "hold" ? "" : "window.tripGoogleMapsReady();",
        });
  });
  await page.route("**/api/data-mode", (route) =>
    route.fulfill({
      json: {
        configured: "mock",
        providers: { maps: true, hotelsAndFlights: false, webMapsProvider: provider },
      },
    }),
  );
  await page.route("**/api/places/search", (route) =>
    route.fulfill({ json: { places: [sydney] } }),
  );
  await page.route("**/api/places/details", (route) => {
    const id = route.request().postDataJSON().placeId;
    const stop = items.find((item) => item.placeId === id);
    return route.fulfill({
      json: {
        place: stop
          ? {
              id,
              displayName: { text: stop.detail },
              location: stop.savedPlace.location,
              source: "google",
            }
          : sydney,
      },
    });
  });
  await page.route("**/api/trip/preview-edit", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Renderer fixture does not verify route durations" },
    }),
  );
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await enterTrip(page, width, language);
  return { context, page, errors };
}

async function enterTrip(page, width, language) {
  await (
    width <= 520
      ? page.getByRole("tab", { name: language === "zh" ? /^我的/ : /^Mine/ })
      : page
          .locator(".sidebar-nav")
          .getByRole("button", { name: language === "zh" ? /^行程/ : /^Trips/ })
  ).click();
  await page
    .locator(".trip-cards, .phone-mine")
    .getByRole("button", { name: /Sydney/ })
    .first()
    .click();
  await page.locator(".trip-home").waitFor();
}

const mapScope = (page) => page.locator(".trip-home");

async function settled(page, provider) {
  const scope = mapScope(page);
  const map = scope.locator(
    `.trip-map-canvas:not(.trip-map-canvas--empty) .google-map${provider ? `[data-provider=${provider}]` : "[data-provider]"}`,
  );
  await map.waitFor({ state: "visible" });
  if ((page.viewportSize()?.width ?? 0) <= 520) {
    await page.evaluate(() => {
      const shell = document.querySelector(".workspace-shell--trips");
      if (shell) shell.scrollTop = shell.scrollHeight;
    });
  }
  await map.waitFor({ state: "visible" });
  if ((await map.getAttribute("data-provider")) === "osm")
    await scope.locator(".google-map[data-map-ready=true]").waitFor();
  const marker = scope.locator(".trip-map-marker").nth(1);
  await marker.waitFor({ state: "visible" });
}

async function phoneSurfaceSettled(page, provider) {
  await page.waitForFunction((expectedProvider) => {
    const map = document.querySelector(`.trip-home .google-map[data-provider=${expectedProvider}]`);
    const owner = map?.closest(".trip-map-canvas");
    if (!map || !owner) return false;
    const mapRect = map.getBoundingClientRect();
    const ownerRect = owner.getBoundingClientRect();
    return (
      Math.abs(mapRect.width - ownerRect.width) <= 2 &&
      Math.abs(mapRect.height - ownerRect.height) <= 2
    );
  }, provider);
}

async function unmountMap(page) {
  await page.locator(".trip-home__head button").first().click();
  await page.locator(".trip-home").waitFor({ state: "detached" });
}

try {
  const scenarios = [
    { name: "osm-desktop-unmount", width: 1440, language: "en", provider: "osm" },
    {
      name: "google-constructor",
      width: 1440,
      language: "en",
      provider: "google-with-fallback",
      failure: "constructor",
    },
    {
      name: "google-strict-retry",
      width: 1440,
      language: "en",
      provider: "google",
      failure: "constructor",
      strict: true,
    },
    {
      name: "google-host-replaced-recovery",
      width: 1440,
      language: "en",
      provider: "google-with-fallback",
      hostReplacement: true,
    },
    {
      name: "google-auth-phone",
      width: 390,
      language: "zh",
      provider: "google-with-fallback",
      failure: "auth",
    },
    {
      name: "google-script",
      width: 390,
      language: "en",
      provider: "google-with-fallback",
      failure: "script",
    },
    { name: "google-success-phone", width: 390, language: "en", provider: "google" },
    { name: "held-sdk-unmount", width: 1440, language: "en", provider: "google", failure: "hold" },
  ];
  for (const scenario of scenarios) {
    let current;
    try {
      current = await open(scenario);
      const { page, errors } = current;
      const scope = mapScope(page);
      if (scenario.failure === "hold") {
        await page.locator(".trip-home__head button").first().click();
        await page.locator(".trip-home").waitFor({ state: "detached" });
        await page.evaluate(async () => window.__googleRendererFixture.releaseLoad());
        await page.waitForFunction(() => window.tripGoogleMapsReady === undefined);
        await page.waitForFunction(() => window.__googleRendererFixture.loadSettled === true);
        check(
          (await page.evaluate(() => window.__googleRendererFixture.maps.length)) === 0,
          `${scenario.name}: aborted SDK response creates no orphan map`,
        );
        check(
          (await page.evaluate(() => window.__googleRendererFixture.pending.size)) === 0,
          `${scenario.name}: aborted SDK response leaves no callbacks`,
        );
        check(errors.length === 0, `${scenario.name}: aborted load has no browser errors`, errors);
        continue;
      }
      if (scenario.strict) {
        await scope.locator(".trip-map-fallback").waitFor();
        check(
          (await scope.locator("[aria-label='Mapped places'] button").count()) === 2,
          `${scenario.name}: strict failure keeps saved places available`,
        );
        check(
          await scope.getByRole("button", { name: "Satellite view", exact: true }).isDisabled(),
          `${scenario.name}: strict failure disables satellite`,
        );
        check(
          await scope.getByRole("button", { name: "Zoom in", exact: true }).isDisabled(),
          `${scenario.name}: strict failure disables zoom`,
        );
        await page
          .getByRole("textbox", { name: "New chat" })
          .fill("Map failure leaves Chat usable");
        await page.locator('[data-card="itinerary"]').click();
        await page.getByRole("button", { name: "Harbour walk", exact: true }).waitFor();
        await page.getByRole("button", { name: "Close Itinerary" }).click();
        await page.evaluate(() => window.__googleRendererFixture.configure("none"));
        await scope.getByRole("button", { name: "Retry map" }).click();
        await settled(page, "google");
        check(
          (await scope.locator(".trip-map-fallback").count()) === 0,
          `${scenario.name}: retry removes the app error`,
        );
      }
      if (scenario.failure === "auth") {
        await settled(page, "google");
        await page.evaluate(() => window.__googleRendererFixture.fail());
      }
      if (scenario.hostReplacement) {
        await settled(page, "google");
        await page.evaluate(() => window.__googleRendererFixture.replaceHost());
        await unmountMap(page);
        check(
          await page.evaluate(
            () => window.gm_authFailure === window.__googleRendererFixture.externalAuthFailure,
          ),
          `${scenario.name}: external host survives owner disposal`,
        );
        await enterTrip(page, scenario.width, scenario.language);
        await settled(page, "google");
        await page.evaluate(() => window.__googleRendererFixture.fail());
      }
      const expectedProvider = scenario.provider === "google" ? "google" : "osm";
      await settled(page, expectedProvider);
      if (scenario.width <= 520) {
        await phoneSurfaceSettled(page, expectedProvider);
        const surface = await scope
          .locator(`.google-map[data-provider=${expectedProvider}]`)
          .evaluate((element) => {
            const rect = (node) => {
              const box = node?.getBoundingClientRect();
              return box ? { width: box.width, height: box.height, x: box.x, y: box.y } : undefined;
            };
            return {
              renderer: rect(element),
              owned: rect(element.querySelector(".google-map__renderer")),
              canvas: rect(element.closest(".trip-map-canvas")),
              container: rect(element.closest(".trip-home__map")),
              phone: document.querySelector(".workspace-app")?.hasAttribute("data-phone"),
              viewport: { width: innerWidth, height: innerHeight },
            };
          });
        check(
          surface.renderer.width >= 320 &&
            surface.renderer.height >= 320 &&
            surface.owned.width >= 320 &&
            surface.owned.height >= 320,
          `${scenario.name}: 390px Trip home renders the full map surface`,
          surface,
        );
      }
      if (expectedProvider === "google") {
        check(
          (await scope.locator(".google-map__renderer").count()) === 1 &&
            (await scope.locator("[data-fixture-error]").count()) === 0 &&
            (await scope.locator("[data-fixture-renderer]").count()) === 1 &&
            (await scope.locator("fixture-google-marker").count()) === 2,
          `${scenario.name}: Google success keeps exactly one active renderer`,
        );
      } else {
        check(
          (await scope.locator(".google-map__renderer").count()) === 1 &&
            (await scope
              .locator("[data-fixture-error], [data-fixture-renderer], fixture-google-marker")
              .count()) === 0,
          `${scenario.name}: fallback removes stale Google layers`,
        );
      }
      check(
        (await scope.locator(".trip-map-fallback").count()) === 0,
        `${scenario.name}: recovered map has no stale app error`,
      );
      const satellite = scope.getByRole("button", {
        name: scenario.language === "zh" ? "卫星视图" : "Satellite view",
        exact: true,
      });
      check(
        (await satellite.isDisabled()) === (expectedProvider === "osm"),
        `${scenario.name}: satellite availability matches the renderer`,
      );
      await scope
        .getByRole("button", {
          name: scenario.language === "zh" ? "放大" : "Zoom in",
          exact: true,
        })
        .click();
      const marker = scope
        .locator(
          expectedProvider === "osm"
            ? "trip-libre-marker[role=button]"
            : "fixture-google-marker[role=button]",
        )
        .first();
      await marker.focus();
      await marker.press("Enter");
      await scope.locator(".trip-map-popup").waitFor();
      check(
        await scope.locator(".trip-map-popup").isVisible(),
        `${scenario.name}: keyboard opens visible stop details`,
      );
      await page.screenshot({ path: resolve(OUT, `${scenario.name}.png`) });
      if (scenario.width <= 520) {
        for (const width of [521, 520, 1440, 390]) {
          await page.setViewportSize({ width, height: width <= 520 ? 844 : 1000 });
          await page.waitForFunction(
            (phone) =>
              document.querySelector(".workspace-app")?.hasAttribute("data-phone") === phone,
            width <= 520,
          );
          await settled(page);
          check(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${scenario.name}: no overflow at ${width}`,
          );
        }
      }
      await unmountMap(page);
      await page.evaluate(() => window.__googleRendererFixture.releaseIdle());
      check(errors.length === 0, `${scenario.name}: unmount has no browser errors`, errors);
      const callbacks = await page.evaluate((hostReplacement) => {
        const fixture = window.__googleRendererFixture;
        const ownerListeners = (map) =>
          [...map.listeners.values()].reduce((events, listeners) => events + listeners.size, 0);
        const connected = fixture.maps.filter((map) => map.element.isConnected);
        const tripHome = fixture.maps.filter((map) => map.tripHome);
        const releasedHost = hostReplacement
          ? fixture.externalAuthFailure
          : fixture.previousAuthFailure;
        const hostReleased = window.gm_authFailure === releasedHost;
        return {
          previousAuthCalls: fixture.previousAuthCalls,
          externalAuthCalls: fixture.externalAuthCalls,
          authDispatches: fixture.authDispatches,
          hostReleased,
          pending: fixture.pending.size,
          live: connected.reduce((count, map) => count + ownerListeners(map), 0),
          disconnectedLive: fixture.maps.filter((map) => !map.destroyed && !map.element.isConnected)
            .length,
          disposedListeners: fixture.maps
            .filter((map) => map.destroyed)
            .reduce((count, map) => count + ownerListeners(map), 0),
          tripHomeConnected: tripHome.filter((map) => map.element.isConnected).length,
          tripHomeUndestroyed: tripHome.filter((map) => !map.destroyed).length,
          tripHomeLiveListeners: tripHome
            .filter((map) => map.element.isConnected)
            .reduce((count, map) => count + ownerListeners(map), 0),
          backgroundOwners: connected.filter((map) => !map.tripHome).length,
        };
      }, scenario.hostReplacement);
      check(
        callbacks.hostReleased === (callbacks.backgroundOwners === 0) &&
          (scenario.hostReplacement
            ? callbacks.externalAuthCalls === callbacks.authDispatches
            : callbacks.previousAuthCalls === callbacks.authDispatches) &&
          (scenario.name !== "google-auth-phone" || callbacks.authDispatches > 0),
        `${scenario.name}: host auth handler runs once per dispatch`,
        callbacks,
      );
      check(
        callbacks.pending === callbacks.live &&
          callbacks.disconnectedLive === 0 &&
          callbacks.disposedListeners === 0 &&
          callbacks.tripHomeConnected === 0 &&
          callbacks.tripHomeUndestroyed === 0 &&
          callbacks.tripHomeLiveListeners === 0,
        `${scenario.name}: unmount leaves no orphan maps or callbacks`,
        callbacks,
      );
    } catch (error) {
      results.push({
        ok: false,
        name: scenario.name,
        error: String(error),
        errors: current?.errors,
      });
      await current?.page
        .screenshot({ path: resolve(OUT, `${scenario.name}-failure.png`) })
        .catch(() => {});
    } finally {
      await current?.context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(
    resolve(OUT, "summary.json"),
    JSON.stringify(
      {
        results,
        fixture: "controlled Google SDK; real MapLibre empty style; external HTTP intercepted",
        passed: results.every((result) => result.ok),
      },
      null,
      2,
    ),
  );
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
