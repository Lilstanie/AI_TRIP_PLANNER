export function installGoogleRendererFixture({ failure = "none" } = {}) {
  const maps = [];
  const pending = new Set();
  const previousAuthFailure = () => {
    fixture.previousAuthCalls += 1;
  };
  window.gm_authFailure = previousAuthFailure;
  const fixture = (window.__googleRendererFixture = {
    previousAuthCalls: 0,
    externalAuthCalls: 0,
    authDispatches: 0,
    authRejected: false,
    previousAuthFailure,
    externalAuthFailure: undefined,
    maps,
    pending,
    failure,
    configure(next) {
      this.failure = next;
    },
    fail() {
      this.authRejected = true;
      this.authDispatches += 1;
      for (const map of maps) {
        if (map.destroyed || !map.element.isConnected) continue;
        const error = document.createElement("div");
        error.className = "gm-err-container";
        error.dataset.fixtureError = "";
        error.textContent = "Controlled Google authentication failure";
        map.element.append(error);
      }
      window.gm_authFailure?.();
    },
    replaceHost() {
      this.externalAuthFailure = () => {
        this.externalAuthCalls += 1;
      };
      window.gm_authFailure = this.externalAuthFailure;
    },
    releaseIdle() {
      for (const map of maps) {
        if (!map.destroyed && map.element.isConnected) map.emit("idle");
      }
    },
    releaseLoad() {
      window.tripGoogleMapsReady?.();
      return Promise.resolve().then(() => {
        this.loadSettled = true;
      });
    },
  });
  class FixtureMap {
    constructor(element, options) {
      this.element = element;
      this.tripHome = Boolean(element.closest(".trip-home"));
      this.center = options.center;
      this.zoom = options.zoom;
      this.listeners = new Map();
      this.destroyed = false;
      const layer = document.createElement("div");
      layer.className =
        fixture.failure === "constructor" ? "gm-err-container" : "fixture-google-layer";
      if (fixture.failure === "constructor") layer.dataset.fixtureError = "";
      else layer.dataset.fixtureRenderer = "";
      element.append(layer);
      if (fixture.failure === "constructor")
        throw new Error("Controlled Google constructor failure");
      maps.push(this);
    }
    addListener(event, callback) {
      if (event === "error" && fixture.authRejected) queueMicrotask(() => fixture.fail());
      const callbacks = this.listeners.get(event) ?? new Set();
      callbacks.add(callback);
      this.listeners.set(event, callbacks);
      const handle = {
        remove: () => {
          callbacks.delete(callback);
          pending.delete(handle);
        },
      };
      pending.add(handle);
      return handle;
    }
    emit(event) {
      for (const callback of [...(this.listeners.get(event) ?? [])]) callback();
    }
    destroy() {
      this.destroyed = true;
      for (const callbacks of this.listeners.values()) callbacks.clear();
      this.listeners.clear();
      this.element.replaceChildren();
    }
    fitBounds(bounds) {
      this.setCenter(bounds.points[0]);
    }
    panTo(point) {
      this.setCenter(point);
    }
    setCenter(point) {
      this.center = point;
      this.emit("center_changed");
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
    }
    getZoom() {
      return this.zoom;
    }
    setOptions() {}
    setMapTypeId() {}
    resize() {}
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
      this.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        this.click();
      });
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
  class Polyline {
    setMap() {}
    setOptions() {}
  }
  if (!customElements.get("fixture-google-marker"))
    customElements.define("fixture-google-marker", Marker);
  window.google = {
    maps: {
      Map: FixtureMap,
      LatLngBounds: Bounds,
      marker: { AdvancedMarkerElement: Marker },
      Polyline,
      geometry: { encoding: { decodePath: () => [] } },
      event: {
        addListenerOnce(map, event, callback) {
          const handle = map.addListener(event, () => {
            handle.remove();
            callback();
          });
          return handle;
        },
      },
    },
  };
}
