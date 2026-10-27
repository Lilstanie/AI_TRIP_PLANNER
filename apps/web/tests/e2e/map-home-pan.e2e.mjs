import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/map-home-pan", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const sydney = {
  id: "home-sydney",
  displayName: { text: "Sydney" },
  location: { latitude: -33.87, longitude: 151.21 },
};

function installProbe() {
  localStorage.setItem("trip.dataMode", "mock");
  localStorage.setItem(
    "trip.settings.v1",
    JSON.stringify({
      version: 1,
      travel: { homeCity: "Sydney", preferences: [] },
      dataMode: "mock",
      appearance: "light",
      language: "en",
      updatedAt: "2026-10-27T00:00:00Z",
    }),
  );
  const probe = (window.__mapProbe = { maps: [] });
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
    destroy() {}
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
  customElements.define("home-probe-marker", Marker);
  class Polyline {
    setMap() {}
    setOptions() {}
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

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const errors = [];

async function open() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.addInitScript(installProbe);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  const origin = new URL(BASE).origin;
  await page.route(/^https?:\/\//, (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  await page.route("**/maps/api/js?*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "window.tripGoogleMapsReady();" }),
  );
  await page.route("**/api/data-mode", (route) =>
    route.fulfill({
      json: {
        configured: "mock",
        providers: { maps: true, hotelsAndFlights: false, webMapsProvider: "google" },
      },
    }),
  );
  let release;
  const held = new Promise((done) => (release = done));
  await page.route("**/api/places/search", async (route) => {
    await held;
    await route.fulfill({ json: { places: [sydney] } });
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction(() => window.__mapProbe.maps.length > 0);
  return { context, page, release };
}

const view = (page) =>
  page.evaluate(() => {
    const map = window.__mapProbe.maps.at(-1);
    return { lat: map.center.lat, lng: map.center.lng, zoom: map.zoom };
  });
const homeReady = (page) =>
  page.waitForFunction(
    () => document.querySelector(".trip-map-canvas")?.dataset.basemapCentre === "home",
  );

try {
  {
    const { context, page, release } = await open();
    const before = await view(page);
    check(
      before.zoom === 2,
      "the map starts on the world view while the home base is pending",
      before,
    );
    release();
    await homeReady(page);
    await page.waitForFunction(() => window.__mapProbe.maps.at(-1).zoom === 9);
    const after = await view(page);
    check(
      after.lat === -33.87 && after.lng === 151.21 && after.zoom === 9,
      "an untouched map centres on the home base at the home zoom",
      after,
    );
    await page.screenshot({ path: `${OUT}/untouched.png` });
    await context.close();
  }

  {
    const { context, page, release } = await open();
    await page.evaluate(() => {
      const map = window.__mapProbe.maps.at(-1);
      map.emit("dragstart");
      map.center = { lat: 10, lng: 20 };
      map.emit("center_changed");
      map.setZoom(5);
    });
    release();
    await homeReady(page);
    await page.waitForTimeout(500);
    const after = await view(page);
    check(
      after.lat === 10 && after.lng === 20 && after.zoom === 5,
      "a map the traveller panned and zoomed stays where they left it when the home base resolves",
      after,
    );
    await page.screenshot({ path: `${OUT}/panned.png` });
    await context.close();
  }
  check(errors.length === 0, "browser has no page errors", errors);
} catch (error) {
  check(false, "home-base journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((entry) => !entry.ok) ? 1 : 0;
