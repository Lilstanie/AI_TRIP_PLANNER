import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/map-animation-lifecycle", process.env.LABEL ?? "after");
mkdirSync(OUT, { recursive: true });
const results = [];
const samples = [];
const errors = [];
const check = (condition, name) => {
  results.push({ ok: !!condition, name });
  assert.ok(condition, name);
};

const places = [0, 1].map((index) => ({
  id: `animation-stop-${index}`,
  displayName: { text: `Museum ${index + 1}` },
  location: { latitude: 35 + index * 0.01, longitude: 139 + index * 0.01 },
}));
const draft = {
  destination: "Tokyo",
  origin: "",
  start: "2030-10-01",
  end: "2030-10-02",
  groupSize: "2",
  budgetTotal: "2000",
  preferences: [],
  nationality: "",
  roomAllocation: "shared",
  minRating: "0",
  freeCancellation: false,
};
const plan = {
  tripId: "animation-trip",
  brief: {
    tripId: "animation-trip",
    userId: "local",
    destination: "Tokyo",
    dates: [draft.start, draft.end],
    groupSize: 2,
    budgetTotal: 2000,
  },
  round: 1,
  budgetTotal: 2000,
  estTotal: 0,
  overrunPct: -100,
  sections: [
    {
      id: "itinerary",
      label: "Day plan",
      status: "draft",
      summary: "Two museums",
      estCost: 0,
      proposal: {
        agent: "itinerary",
        summary: "Two museums",
        assumptions: [],
        conflictsWith: [],
        items: places.map((place, index) => ({
          id: `stop-${index}`,
          kind: "activity",
          day: 1,
          detail: place.displayName.text,
          location: place.displayName.text,
          placeId: place.id,
          estCost: 0,
          startTime: index ? "14:00" : "09:00",
          endTime: index ? "15:00" : "10:00",
          savedPlace: { name: place.displayName.text, location: place.location },
        })),
      },
    },
  ],
};
const snapshot = {
  version: 4,
  id: "animation-chat",
  savedAt: "2026-10-11T00:00:00Z",
  plan,
  draft,
  messages: [],
  input: "",
};

function installProbe({ snapshot, initiallyHidden }) {
  localStorage.setItem("trip-workspace-v1", JSON.stringify(snapshot));
  localStorage.setItem("trip.dataMode", "mock");
  localStorage.setItem("trip.locationPrompt", "dismissed");
  localStorage.setItem(
    "trip.settings.v1",
    JSON.stringify({
      version: 1,
      travel: { homeCity: "", preferences: [] },
      dataMode: "mock",
      appearance: "light",
      language: "en",
      updatedAt: "2026-10-11T00:00:00Z",
    }),
  );
  const nativeFrame = window.requestAnimationFrame.bind(window);
  let sequence = 0,
    time = 0,
    controlled = false,
    hidden = initiallyHidden;
  const pending = new Map();
  const probe = (window.__mapProbe = {
    updates: 0,
    created: 0,
    removed: 0,
    staleUpdates: 0,
    destroyed: 0,
    maps: [],
    pending: () => pending.size,
    visibility(value) {
      hidden = value;
      document.dispatchEvent(new Event("visibilitychange"));
    },
    control() {
      time = performance.now();
      controlled = true;
    },
    async step(count = 8) {
      for (let i = 0; i < count; i += 1) {
        await new Promise(nativeFrame);
        time += 40;
        const callbacks = [...pending];
        for (const [id, callback] of callbacks) {
          if (!pending.delete(id)) continue;
          callback(time);
        }
      }
    },
  });
  Object.defineProperty(document, "hidden", { get: () => hidden });
  Object.defineProperty(document, "visibilityState", {
    get: () => (hidden ? "hidden" : "visible"),
  });
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: undefined });
  window.requestAnimationFrame = (callback) => {
    const id = ++sequence;
    pending.set(id, callback);
    if (!controlled)
      nativeFrame((at) => {
        if (pending.delete(id)) callback(at);
      });
    return id;
  };
  window.cancelAnimationFrame = (id) => pending.delete(id);

  class FakeMap {
    constructor(element, options) {
      this.element = element;
      this.center = options.center;
      this.zoom = options.zoom;
      this.listeners = new Map();
      probe.maps.push(this);
    }
    addListener(event, fn) {
      const callbacks = this.listeners.get(event) ?? new Set();
      callbacks.add(fn);
      this.listeners.set(event, callbacks);
      return { remove: () => callbacks.delete(fn) };
    }
    emit(event) {
      this.listeners.get(event)?.forEach((fn) => fn());
    }
    resize() {}
    destroy() {
      probe.destroyed += 1;
    }
    fitBounds(bounds) {
      this.setCenter(bounds.points[0]);
    }
    panTo(position) {
      this.setCenter(position);
    }
    setCenter(position) {
      this.center = position;
      this.emit("center_changed");
      this.emit("idle");
    }
    getCenter() {
      return { lat: () => this.center.lat, lng: () => this.center.lng };
    }
    getBounds() {
      return { contains: () => true };
    }
    setZoom(zoom) {
      this.zoom = zoom;
      this.emit("zoom_changed");
      this.emit("idle");
    }
    getZoom() {
      return this.zoom;
    }
    setOptions() {}
    setMapTypeId() {}
  }
  class Bounds {
    points = [];
    extend(point) {
      this.points.push(point);
    }
    isEmpty() {
      return !this.points.length;
    }
  }
  class Marker extends HTMLElement {
    constructor(options) {
      super();
      this.current = options.map;
      this.append(options.content);
      this.setAttribute("role", "button");
      this.setAttribute("aria-label", options.title);
      this.tabIndex = 0;
      this.addEventListener("click", () => this.dispatchEvent(new Event("gmp-click")));
      options.map.element.append(this);
    }
    get map() {
      return this.current;
    }
    set map(value) {
      this.current = value;
      if (!value) this.remove();
    }
  }
  customElements.define("map-probe-marker", Marker);
  class Polyline {
    constructor(options) {
      this.map = options.map;
      probe.created += 1;
    }
    setMap(value) {
      if (!value && this.map) probe.removed += 1;
      this.map = value;
    }
    setOptions() {
      probe.updates += 1;
      if (!this.map) probe.staleUpdates += 1;
    }
  }
  window.google = {
    maps: {
      Map: FakeMap,
      LatLngBounds: Bounds,
      marker: { AdvancedMarkerElement: Marker },
      Polyline,
      geometry: { encoding: { decodePath: () => [] } },
      event: {
        addListenerOnce(map, event, fn) {
          const listener = map.addListener(event, () => {
            listener.remove();
            fn();
          });
          queueMicrotask(() => map.emit(event));
          return listener;
        },
      },
    },
  };
}

async function open(
  browser,
  { osm = false, initiallyHidden = false, reducedMotion = "no-preference" } = {},
) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion,
    serviceWorkers: "block",
  });
  await context.addInitScript(installProbe, { snapshot, initiallyHidden });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  const origin = new URL(BASE).origin;
  await page.route(/^https?:\/\//, (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    return route.abort();
  });
  await page.route("**/maps/api/js?*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "window.tripGoogleMapsReady();" }),
  );
  await page.route("**/api/data-mode", (route) =>
    route.fulfill({
      json: {
        configured: "mock",
        providers: { maps: true, hotelsAndFlights: false, webMapsProvider: osm ? "osm" : "google" },
      },
    }),
  );
  await page.route("**/api/places/search", (route) =>
    route.fulfill({ json: { places: [places[0]] } }),
  );
  await page.route("**/api/places/details", (route) =>
    route.fulfill({
      json: {
        place:
          places.find((place) => place.id === route.request().postDataJSON().placeId) ?? places[0],
      },
    }),
  );
  await page.route("**/api/trip/preview-edit", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Animation fixture does not verify travel times" },
    }),
  );
  await page.goto(BASE);
  await page.locator(".phone-tabbar").waitFor();
  await page.getByRole("tab", { name: "Mine", exact: true }).click();
  await page
    .getByRole("region", { name: "Chats", exact: true })
    .getByRole("button", { name: /^Tokyo ·/ })
    .click();
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  try {
    await page
      .locator(`.google-map[data-provider=${osm ? "osm" : "google"}]`)
      .waitFor({ state: "attached" });
  } catch (error) {
    await page.screenshot({ path: resolve(OUT, "initialization-failure.png") });
    writeFileSync(
      resolve(OUT, "initialization-failure.txt"),
      await page.locator("body").innerText(),
    );
    throw error;
  }
  if (osm) {
    await page.getByRole("tab", { name: "Map", exact: true }).click();
    await page.locator(".google-map[data-map-ready=true]").waitFor();
  } else
    await page.waitForFunction(() => document.querySelectorAll("map-probe-marker").length === 2);
  await page.evaluate(() => window.__mapProbe.control());
  return { context, page };
}

async function sample(page, name, animate) {
  const value = await page.evaluate(async () => {
    const p = window.__mapProbe;
    await p.step(3);
    const before = p.updates;
    await p.step(8);
    return {
      updates: p.updates - before,
      pending: p.pending(),
      created: p.created,
      removed: p.removed,
      staleUpdates: p.staleUpdates,
      maps: p.maps.length,
      destroyed: p.destroyed,
    };
  });
  samples.push({ name, ...value });
  check(
    animate ? value.updates === 8 : value.updates === 0,
    `${name}: ${animate ? "one" : "no"} dash update per stepped frame`,
  );
  check(
    value.pending === (animate ? 1 : 0),
    `${name}: ${animate ? "one pending frame" : "no recurring frames"}`,
  );
  check(value.staleUpdates === 0, `${name}: no updates on removed layers`);
  return value;
}

let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
  });
  const { context, page } = await open(browser);
  const tab = (name) => page.getByRole("tab", { name, exact: true });
  await sample(page, "initial phone Chat", false);
  await tab("Map").click();
  await sample(page, "visible phone Map", true);
  await page.locator("map-probe-marker").first().click();
  await page.locator(".phone-map-details").waitFor();
  await page.evaluate(() => {
    const map = window.__mapProbe.maps[0];
    map.emit("dragstart");
    map.setCenter({ lat: 36, lng: 140 });
    map.setZoom(15);
  });
  const baseline = await sample(page, "selected stop", true);
  for (const name of ["Chat", "Trip", "Mine", "Chat"]) {
    await tab(name).click();
    await sample(page, `hidden in ${name}`, false);
    await tab("Map").click();
    const resumed = await sample(page, `return from ${name}`, true);
    check(
      resumed.maps === baseline.maps &&
        resumed.created === baseline.created &&
        resumed.removed === baseline.removed,
      `${name}: map and route layers retained`,
    );
  }
  check(
    await page.evaluate(() => {
      const map = window.__mapProbe.maps[0];
      return map.center.lat === 36 && map.center.lng === 140 && map.zoom === 15;
    }),
    "camera preserved across phone tabs",
  );
  check(await page.locator(".phone-map-details").isVisible(), "selected stop popup retained");
  await page.screenshot({ path: resolve(OUT, "retained-selection.png"), animations: "disabled" });
  await page.evaluate(() => window.__mapProbe.visibility(true));
  await sample(page, "document hidden", false);
  await tab("Chat").click();
  await page.evaluate(() => window.__mapProbe.visibility(false));
  await sample(page, "document visible but panel hidden", false);
  await tab("Map").click();
  await sample(page, "both visible again", true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await sample(page, "reduced motion enabled live", false);
  await page.evaluate(() => window.__mapProbe.visibility(true));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await sample(page, "motion allowed but document hidden", false);
  await page.evaluate(() => window.__mapProbe.visibility(false));
  await sample(page, "motion and visibility restored", true);
  await page.setViewportSize({ width: 800, height: 900 });
  await page
    .getByRole("group", { name: "Workspace view" })
    .getByRole("button", { name: "Chat", exact: true })
    .click();
  await sample(page, "tablet Chat hides Map", false);
  await page.setViewportSize({ width: 1440, height: 900 });
  await sample(page, "desktop Map visible despite saved Chat tab", true);
  await page.getByRole("button", { name: /^Trips/ }).click();
  await sample(page, "map unmounted on Trips page", false);
  check(
    await page.evaluate(() => window.__mapProbe.destroyed === 1),
    "map destroyed only on unmount",
  );
  await context.close();

  for (const initial of [{ initiallyHidden: true }, { reducedMotion: "reduce" }]) {
    const { context, page } = await open(browser, initial);
    await page.getByRole("tab", { name: "Map", exact: true }).click();
    await sample(page, `initial ${JSON.stringify(initial)}`, false);
    await page.evaluate(() => window.__mapProbe.visibility(false));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await sample(page, `resume ${JSON.stringify(initial)}`, true);
    await context.close();
  }
  const osm = await open(browser, { osm: true });
  await sample(osm.page, "OSM visible", false);
  check(
    (await osm.page.locator("trip-libre-marker").count()) === 2,
    "OSM keeps located stop markers",
  );
  await osm.page.getByRole("tab", { name: "Chat", exact: true }).click();
  await sample(osm.page, "OSM hidden", false);
  await osm.page.getByRole("tab", { name: "Map", exact: true }).click();
  await sample(osm.page, "OSM returned", false);
  await osm.page.screenshot({ path: resolve(OUT, "osm-static.png"), animations: "disabled" });
  await osm.context.close();
  check(errors.length === 0, `no browser page errors: ${errors.join("; ")}`);
} catch (error) {
  errors.push(String(error));
  process.exitCode = 1;
} finally {
  await browser?.close();
  writeFileSync(
    resolve(OUT, "summary.json"),
    JSON.stringify(
      {
        baseUrl: BASE,
        results,
        samples,
        errors,
        passed: process.exitCode !== 1,
        boundary:
          "Google-compatible SDK stub, real MapLibre empty style, controlled visibility and RAF; no live Google verification",
      },
      null,
      2,
    ),
  );
}
