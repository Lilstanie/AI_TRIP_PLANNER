"use client";
import {
  nativePlugin,
  type NativeListener,
  type NativePlugin,
} from "@/components/pwa/native-shell";
import { decodePath } from "@/lib/map/polyline";
import type { Coordinate, MapMarker, MapsSDK } from "./google-maps-sdk";

type Region = {
  lat: number;
  lng: number;
  zoom: number;
  north: number;
  south: number;
  east: number;
  west: number;
};
type Rect = { x: number; y: number; width: number; height: number };
type Camera = { lat?: number; lng?: number; zoom?: number; animated: boolean };

const OCCLUDERS = [
  ".workspace-topbar",
  ".phone-tabbar:not([data-hidden])",
  ".phone-map-sheet",
  ".trip-map > :not(.google-map)",
  "[role='dialog']",
  ".drawer",
  ".fact-popover",
].join(",");
const HOLE = "nativeMapHole";
let sequence = 0;
let probe: CanvasRenderingContext2D | null | undefined;

function hex(color: string | undefined, opacity = 1) {
  probe ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext(
    "2d",
    { willReadFrequently: true },
  );
  if (!probe || !color) return "#0071e3ff";
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#0071e3";
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b, Math.round(a * opacity)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const rectOf = (box: DOMRect): Rect => ({
  x: Math.round(box.left),
  y: Math.round(box.top),
  width: Math.round(box.width),
  height: Math.round(box.height),
});
const overlaps = (a: DOMRect, b: DOMRect) =>
  a.width > 0 &&
  a.height > 0 &&
  a.left < b.right &&
  a.right > b.left &&
  a.top < b.bottom &&
  a.bottom > b.top;

class Bounds {
  north = -90;
  south = 90;
  east = -180;
  west = 180;
  extend(point: object) {
    const { lat, lng } = point as Coordinate;
    this.north = Math.max(this.north, lat);
    this.south = Math.min(this.south, lat);
    this.east = Math.max(this.east, lng);
    this.west = Math.min(this.west, lng);
  }
  isEmpty() {
    return this.north < this.south;
  }
}

class AppleMap {
  native: NativePlugin;
  element: HTMLElement;
  host: HTMLElement;
  markers = new Map<string, AppleMarker>();
  region: Region;
  maxZoom: number | null = null;
  private listeners = new Map<string, Set<() => void>>();
  private subscriptions: NativeListener[] = [];
  private camera?: Camera;
  private sentLayout = "";
  private frame = 0;
  private observers: { disconnect(): void }[] = [];
  private holes: HTMLElement[] = [];

  constructor(element: HTMLElement, options: object) {
    const o = options as { center: Coordinate; zoom: number; dark?: boolean };
    this.native = nativePlugin("TripMap")!;
    this.element = element;
    this.host = document.createElement("div");
    this.host.hidden = true;
    element.append(this.host);
    this.region = {
      lat: o.center.lat,
      lng: o.center.lng,
      zoom: o.zoom,
      north: NaN,
      south: NaN,
      east: NaN,
      west: NaN,
    };
    this.subscriptions = [
      this.native.on("regionStart", (data) => {
        if ((data as { gesture?: boolean }).gesture) this.emit("dragstart");
      }),
      this.native.on("region", (data) => this.settle(data as Region)),
      this.native.on("markerTap", (data) =>
        this.markers.get((data as { id: string }).id)?.dispatchEvent(new Event("gmp-click")),
      ),
      this.native.on("mapTap", () => this.emit("click")),
    ];
    void this.native
      .call("create", { lat: o.center.lat, lng: o.center.lng, zoom: o.zoom, dark: !!o.dark })
      .catch(() => this.emit("error"));
    const schedule = () => {
      if (!this.frame) this.frame = requestAnimationFrame(() => this.layout());
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { subtree: true, childList: true, attributes: true });
    window.addEventListener("resize", schedule);
    this.observers = [
      resize,
      mutations,
      { disconnect: () => window.removeEventListener("resize", schedule) },
    ];
    schedule();
  }

  private emit(event: string) {
    this.listeners.get(event)?.forEach((fn) => fn());
  }

  private settle(next: Region) {
    const previous = this.region;
    this.region = next;
    if (Math.abs(previous.zoom - next.zoom) > 1e-6) this.emit("zoom_changed");
    if (Math.abs(previous.lat - next.lat) > 1e-9 || Math.abs(previous.lng - next.lng) > 1e-9)
      this.emit("center_changed");
    this.emit("idle");
  }

  private layout() {
    this.frame = 0;
    const box = this.element.getBoundingClientRect();
    const visible = box.width > 0 && box.height > 0 && this.element.isConnected;
    const canvas = this.element.closest(".trip-map-canvas")?.getBoundingClientRect() ?? box;
    const occluders = visible
      ? [...document.querySelectorAll<HTMLElement>(OCCLUDERS)]
          .filter((node) => !node.contains(this.element) && !this.element.contains(node))
          .map((node) => node.getBoundingClientRect())
          .filter((rect) => overlaps(rect, box))
          .map(rectOf)
      : [];
    const state = {
      visible,
      frame: rectOf(box),
      inset: {
        top: Math.max(0, Math.round(canvas.top - box.top)),
        bottom: Math.max(0, Math.round(box.bottom - canvas.bottom)),
        left: Math.max(0, Math.round(canvas.left - box.left)),
        right: Math.max(0, Math.round(box.right - canvas.right)),
      },
      occluders,
    };
    const key = JSON.stringify(state);
    if (key === this.sentLayout) return;
    this.sentLayout = key;
    this.markHoles(visible);
    void this.native.call("layout", state).catch(() => {});
  }

  private markHoles(visible: boolean) {
    this.holes.forEach((node) => delete node.dataset[HOLE]);
    this.holes = [];
    if (!visible) return;
    for (let node: HTMLElement | null = this.element; node; node = node.parentElement) {
      node.dataset[HOLE] = "";
      this.holes.push(node);
    }
  }

  private move(camera: Omit<Camera, "animated">, animated: boolean) {
    const pending = this.camera;
    this.camera = { ...pending, ...camera, animated: animated || !!pending?.animated };
    Object.assign(this.region, camera);
    if (pending) return;
    queueMicrotask(() => {
      const next = this.camera;
      this.camera = undefined;
      if (next) void this.native.call("camera", next).catch(() => {});
    });
  }

  fitBounds(bounds: unknown, padding = 72) {
    const { north, south, east, west } = bounds as Bounds;
    void this.native
      .call("fit", { north, south, east, west, padding, maxZoom: this.maxZoom })
      .catch(() => {});
  }
  panTo(p: Coordinate) {
    this.move({ lat: p.lat, lng: p.lng }, true);
  }
  setCenter(p: Coordinate) {
    this.move({ lat: p.lat, lng: p.lng }, false);
  }
  getCenter() {
    const { lat, lng } = this.region;
    return { lat: () => lat, lng: () => lng };
  }
  getBounds() {
    const { north, south, east, west } = this.region;
    if (Number.isNaN(north)) return undefined;
    return {
      contains: (p: Coordinate) =>
        p.lat <= north &&
        p.lat >= south &&
        (west <= east ? p.lng >= west && p.lng <= east : p.lng >= west || p.lng <= east),
    };
  }
  setZoom(zoom: number) {
    this.move({ zoom }, true);
  }
  getZoom() {
    return this.region.zoom;
  }
  setOptions(options: object) {
    const o = options as { maxZoom?: number | null; dark?: boolean };
    if ("maxZoom" in o) this.maxZoom = o.maxZoom ?? null;
    if (o.dark !== undefined) void this.native.call("style", { dark: o.dark }).catch(() => {});
  }
  setMapTypeId(type: "roadmap" | "hybrid") {
    void this.native.call("style", { type }).catch(() => {});
  }
  resize() {
    this.sentLayout = "";
    this.layout();
  }
  destroy() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.observers.forEach((observer) => observer.disconnect());
    this.subscriptions.forEach((subscription) => void subscription.remove());
    this.listeners.clear();
    this.markHoles(false);
    this.host.remove();
    void this.native.call("destroy").catch(() => {});
  }
  addListener(event: string, fn: () => void) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(fn);
    this.listeners.set(event, set);
    return { remove: () => void set.delete(fn) };
  }
}

class AppleMarker extends HTMLElement {
  key = `trip-marker-${++sequence}`;
  private owner?: AppleMap;
  private depth = 0;
  private position: Coordinate;
  private clickable: boolean;
  private watcher: MutationObserver;
  private queued = false;

  constructor(options: object) {
    super();
    const o = options as {
      map: AppleMap;
      position: Coordinate;
      content?: HTMLElement;
      title?: string;
      gmpClickable?: boolean;
    };
    this.owner = o.map;
    this.position = o.position;
    this.title = o.title || "";
    this.clickable = !!o.gmpClickable;
    if (o.content) this.append(o.content);
    o.map.host.append(this);
    o.map.markers.set(this.key, this);
    this.watcher = new MutationObserver(() => this.send());
    this.watcher.observe(this, { subtree: true, attributes: true, childList: true });
    this.send();
  }

  private describe() {
    const content = this.firstElementChild as HTMLElement | null;
    const badge = content?.querySelector<HTMLElement>(".trip-map-marker__badge");
    const kind = content?.classList.contains("trip-map-leg-mode")
      ? "mode"
      : content?.classList.contains("trip-map-user-marker")
        ? "user"
        : "stop";
    return {
      id: this.key,
      kind,
      lat: this.position.lat,
      lng: this.position.lng,
      title:
        content?.querySelector(".trip-map-marker__name")?.textContent?.trim() || this.title || "",
      glyph: badge?.textContent?.trim() ?? "",
      color: hex(badge ? getComputedStyle(badge).backgroundColor : undefined),
      mode: content?.dataset.mode ?? "",
      selected: !!content?.classList.contains("is-selected"),
      clickable: this.clickable,
      zIndex: this.depth,
    };
  }

  private send() {
    if (this.queued || !this.owner) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (this.owner) void this.owner.native.call("setMarker", this.describe()).catch(() => {});
    });
  }

  get map() {
    return this.owner;
  }
  set map(value: unknown) {
    if (value || !this.owner) return;
    const owner = this.owner;
    this.owner = undefined;
    this.watcher.disconnect();
    owner.markers.delete(this.key);
    this.remove();
    void owner.native.call("removeMarker", { id: this.key }).catch(() => {});
  }
  get zIndex() {
    return this.depth;
  }
  set zIndex(value: number | null | undefined) {
    this.depth = value || 0;
    this.send();
  }
}

class AppleLine {
  id = `trip-line-${++sequence}`;
  private owner?: AppleMap;
  constructor(options: object) {
    const o = options as {
      map: AppleMap;
      path?: Coordinate[];
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      zIndex?: number;
    };
    if (!o.path?.length || o.strokeOpacity === 0) return;
    this.owner = o.map;
    void o.map.native
      .call("setLine", {
        id: this.id,
        path: o.path.flatMap((p) => [p.lat, p.lng]),
        color: hex(o.strokeColor, o.strokeOpacity ?? 1),
        width: o.strokeWeight || 4,
        zIndex: o.zIndex ?? 0,
      })
      .catch(() => {});
  }
  setMap(value: unknown) {
    if (value || !this.owner) return;
    const owner = this.owner;
    this.owner = undefined;
    void owner.native.call("removeLine", { id: this.id }).catch(() => {});
  }
  setOptions() {}
}

export function nativeAppleMapsAvailable(root: HTMLElement) {
  return Boolean(
    root.closest(".workspace-app[data-phone] .trip-map-canvas") && nativePlugin("TripMap"),
  );
}

export function appleMapsRenderer(): MapsSDK {
  if (!customElements.get("trip-apple-marker"))
    customElements.define("trip-apple-marker", AppleMarker);
  return {
    Map: AppleMap,
    LatLngBounds: Bounds,
    marker: { AdvancedMarkerElement: AppleMarker as unknown as new (o: object) => MapMarker },
    Polyline: AppleLine,
    geometry: { encoding: { decodePath } },
    event: {
      addListenerOnce(instance, event, fn) {
        const map = instance as AppleMap;
        const handle = map.addListener(event, () => {
          handle.remove();
          fn();
        });
        return handle;
      },
    },
  };
}
