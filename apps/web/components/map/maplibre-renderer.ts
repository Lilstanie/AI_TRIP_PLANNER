"use client";
import * as maplibre from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import type { Coordinate, MapsSDK, MapMarker } from "./google-maps-sdk";

maplibre.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#e5ebe4" } }],
};
const styleFor = (dark: boolean, mock: boolean) =>
  mock
    ? {
        ...EMPTY_STYLE,
        layers: [
          {
            id: "background",
            type: "background" as const,
            paint: { "background-color": dark ? "#182326" : "#e5ebe4" },
          },
        ],
      }
    : `https://tiles.openfreemap.org/styles/${dark ? "dark" : "liberty"}`;
const events: Record<string, string> = { zoom_changed: "zoom", center_changed: "move" };
let sequence = 0;

class Bounds {
  value = new maplibre.LngLatBounds();
  extend(p: object) {
    const c = p as Coordinate;
    this.value.extend([c.lng, c.lat]);
  }
  isEmpty() {
    return this.value.isEmpty();
  }
}
class LibreMap {
  native: maplibre.Map;
  maxZoom = 20;
  mock: boolean;
  constructor(element: HTMLElement, options: object) {
    const o = options as { center: Coordinate; zoom: number; dark?: boolean; mock?: boolean };
    this.mock = !!o.mock;
    this.native = new maplibre.Map({
      container: element,
      center: [o.center.lng, o.center.lat],
      zoom: o.zoom,
      style: styleFor(!!o.dark, this.mock),
      attributionControl: false,
    });
    this.native.addControl(
      new maplibre.AttributionControl({
        compact: true,
        customAttribution: this.mock
          ? '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>'
          : undefined,
      }),
      "top-left",
    );
    this.native.on("idle", () => {
      element.dataset.mapReady = "true";
    });
    this.native.on("error", () => {
      element.dataset.mapDegraded = "true";
    });
  }
  fitBounds(bounds: unknown, padding = 72) {
    this.native.fitBounds((bounds as Bounds).value, {
      padding,
      maxZoom: this.maxZoom,
      duration: 0,
    });
  }
  panTo(p: Coordinate) {
    this.native.panTo([p.lng, p.lat]);
  }
  setCenter(p: Coordinate) {
    this.native.setCenter([p.lng, p.lat]);
  }
  getCenter() {
    const p = this.native.getCenter();
    return { lat: () => p.lat, lng: () => p.lng };
  }
  getBounds() {
    const bounds = this.native.getBounds();
    return { contains: (p: Coordinate) => bounds.contains([p.lng, p.lat]) };
  }
  setZoom(zoom: number) {
    this.native.setZoom(zoom);
  }
  getZoom() {
    return this.native.getZoom();
  }
  setOptions(options: object) {
    const o = options as { maxZoom?: number | null; dark?: boolean };
    if ("maxZoom" in o) this.maxZoom = o.maxZoom ?? 20;
    if (o.dark !== undefined) this.native.setStyle(styleFor(o.dark, this.mock));
  }
  setMapTypeId() {}
  resize() {
    this.native.resize();
  }
  destroy() {
    this.native.remove();
  }
  addListener(event: string, fn: () => void) {
    const name = (events[event] || event) as keyof maplibre.MapEventType;
    this.native.on(name, fn);
    return { remove: () => this.native.off(name, fn) };
  }
}
class LibreMarker extends HTMLElement {
  private marker?: maplibre.Marker;
  private current: unknown;
  constructor(options: object) {
    super();
    const o = options as {
      map: LibreMap;
      position: Coordinate;
      content?: HTMLElement;
      title?: string;
      gmpClickable?: boolean;
    };
    this.current = o.map;
    this.title = o.title || "";
    if (o.content) this.append(o.content);
    if (o.gmpClickable) {
      this.tabIndex = 0;
      this.setAttribute("role", "button");
      this.setAttribute("aria-label", this.title);
      this.addEventListener("click", (event) => {
        event.stopPropagation();
        this.dispatchEvent(new Event("gmp-click"));
      });
      this.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.click();
        }
      });
    }
    this.marker = new maplibre.Marker({ element: this, anchor: "center" })
      .setLngLat([o.position.lng, o.position.lat])
      .addTo(o.map.native);
  }
  get map() {
    return this.current;
  }
  set map(value: unknown) {
    this.current = value;
    if (!value) this.marker?.remove();
  }
  get zIndex() {
    return Number(this.style.zIndex) || 0;
  }
  set zIndex(value: number | null | undefined) {
    this.style.zIndex = String(value || 0);
  }
}

class LibreLine {
  id = `trip-route-${++sequence}`;
  map?: LibreMap;
  options: {
    path?: Coordinate[];
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
  };
  constructor(options: object) {
    this.options = options;
    this.map = (options as { map: LibreMap }).map;
    this.map.native.on("style.load", this.draw);
    if (this.map.native.isStyleLoaded()) this.draw();
  }
  draw = () => {
    const map = this.map?.native;
    const o = this.options;
    if (!map || !map.isStyleLoaded() || !o.path?.length || map.getSource(this.id)) return;
    map.addSource(this.id, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: o.path.map((p) => [p.lng, p.lat]) },
      },
    });
    map.addLayer({
      id: this.id,
      type: "line",
      source: this.id,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": o.strokeColor || "#0071e3",
        "line-width": o.strokeWeight || 4,
        "line-opacity": o.strokeOpacity ?? 1,
      },
    });
  };
  setMap(value: unknown) {
    if (value || !this.map) return;
    const map = this.map.native;
    map.off("style.load", this.draw);
    if (map.getLayer(this.id)) map.removeLayer(this.id);
    if (map.getSource(this.id)) map.removeSource(this.id);
    this.map = undefined;
  }
  setOptions() {}
}
function decodePath(value: string): Coordinate[] {
  let i = 0,
    lat = 0,
    lng = 0;
  const path: Coordinate[] = [];
  const read = () => {
    let bits = 0,
      shift = 0,
      byte: number;
    do {
      if (i >= value.length || shift > 30) throw new Error("Invalid route geometry");
      byte = value.charCodeAt(i++) - 63;
      bits |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return bits & 1 ? ~(bits >> 1) : bits >> 1;
  };
  while (i < value.length) {
    lat += read();
    lng += read();
    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return path;
}

export function mapLibreRenderer(): MapsSDK {
  if (!customElements.get("trip-libre-marker"))
    customElements.define("trip-libre-marker", LibreMarker);
  return {
    Map: LibreMap,
    LatLngBounds: Bounds,
    marker: { AdvancedMarkerElement: LibreMarker as unknown as new (o: object) => MapMarker },
    Polyline: LibreLine,
    geometry: { encoding: { decodePath } },
    event: {
      addListenerOnce(instance, event, fn) {
        const map = (instance as LibreMap).native;
        const name = (events[event] || event) as keyof maplibre.MapEventType;
        map.once(name, fn);
        return { remove: () => map.off(name, fn) };
      },
    },
  };
}
