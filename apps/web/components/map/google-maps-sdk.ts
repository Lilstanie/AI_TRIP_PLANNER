"use client";
import type { FramableMap } from "@/lib/map/map-view";
import { NoticeError } from "@/lib/i18n/notice";

export type Coordinate = { lat: number; lng: number };

export type MapPolyline = { setMap(map: unknown): void; setOptions(options: object): void };
export type MapMarker = HTMLElement & {
  map: unknown;
  zIndex?: number | null;
};

export type MapsSDK = {
  Map: new (
    el: HTMLElement,
    options: object,
  ) => {
    resize?(): void;
    destroy?(): void;
    fitBounds(bounds: unknown, padding?: number): void;
    panTo(position: Coordinate): void;
    setCenter(position: Coordinate): void;
    getCenter(): { lat(): number; lng(): number } | undefined;
    getBounds(): { contains(point: Coordinate): boolean } | undefined;
    setZoom(zoom: number): void;
    getZoom(): number | undefined;
    setOptions(options: object): void;
    setMapTypeId(type: "roadmap" | "hybrid"): void;
    addListener(event: string, fn: () => void): { remove(): void } | undefined;
  };
  LatLngBounds: new () => { extend(point: object): void; isEmpty(): boolean };
  event: {
    addListenerOnce(instance: unknown, event: string, fn: () => void): { remove(): void };
  };
  marker: {
    AdvancedMarkerElement: new (options: object) => MapMarker;
  };
  Polyline: new (options: object) => MapPolyline;
  geometry: { encoding: { decodePath(value: string): Coordinate[] } };
};

export type MapRuntime = {
  maps: MapsSDK;
  map: InstanceType<MapsSDK["Map"]>;
  provider: "google" | "osm";
  listen(event: string, fn: () => void): { remove(): void };
  listenOnce(event: string, fn: () => void): { remove(): void };
  onAuthFailure(fn: () => void): { remove(): void };
  dispose(): void;
};

let sdk: Promise<MapsSDK> | undefined;
const authFailureOwners = new Set<() => void>();
let previousAuthFailure: (() => void) | undefined;
let installedAuthFailure: (() => void) | undefined;

export function subscribeGoogleAuthFailure(fn: () => void) {
  const host = window as typeof window & { gm_authFailure?: () => void };
  if (!authFailureOwners.size) {
    previousAuthFailure = host.gm_authFailure;
    installedAuthFailure = () => {
      const previous = previousAuthFailure;
      for (const listener of [...authFailureOwners]) listener();
      previous?.();
    };
    host.gm_authFailure = installedAuthFailure;
  }
  authFailureOwners.add(fn);
  let active = true;
  return {
    remove() {
      if (!active) return;
      active = false;
      authFailureOwners.delete(fn);
      if (!authFailureOwners.size) {
        if (host.gm_authFailure === installedAuthFailure) host.gm_authFailure = previousAuthFailure;
        installedAuthFailure = undefined;
        previousAuthFailure = undefined;
      }
    },
  };
}

export function loadMaps() {
  if (sdk) return sdk;
  sdk = new Promise<MapsSDK>((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      reject(new NoticeError({ key: "Map unavailable: configure the browser Google Maps key." }));
      return;
    }
    const script = document.createElement("script");
    const host = window as unknown as {
      google: { maps: MapsSDK };
      tripGoogleMapsReady?: () => void;
    };
    const timeout = window.setTimeout(() => {
      delete host.tripGoogleMapsReady;
      script.remove();
      reject(
        new NoticeError({
          key: "Google Maps took too long to load. Check your connection and retry.",
        }),
      );
    }, 10_000);
    host.tripGoogleMapsReady = () => {
      window.clearTimeout(timeout);
      resolve(host.google.maps);
      delete host.tripGoogleMapsReady;
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=marker,geometry&v=weekly&loading=async&callback=tripGoogleMapsReady`;
    script.async = true;

    script.onerror = () => {
      window.clearTimeout(timeout);
      delete host.tripGoogleMapsReady;
      script.remove();
      reject(
        new NoticeError({ key: "Google Maps could not load. Check your connection and retry." }),
      );
    };
    document.head.appendChild(script);
  }).catch((error) => {
    sdk = undefined;
    throw error;
  });
  return sdk;
}

export function framable(runtime: MapRuntime, moving: { current: boolean }): FramableMap {
  const { maps, map, listenOnce } = runtime;
  const settle = () => {
    moving.current = true;
    listenOnce("idle", () => {
      moving.current = false;
    });
  };
  return {
    center(point, zoom) {
      settle();
      map.setCenter(point);
      map.setZoom(zoom);
    },
    fit(points, maxZoom) {
      settle();
      const bounds = new maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      map.setOptions({ maxZoom });
      map.fitBounds(bounds, 72);
      listenOnce("idle", () => map.setOptions({ maxZoom: null }));
    },
  };
}
