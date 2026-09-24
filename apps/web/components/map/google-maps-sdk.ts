"use client";
import type { FramableMap } from "@/lib/map/map-view";

export type Coordinate = { lat: number; lng: number };

export type MapPolyline = { setMap(map: unknown): void; setOptions(options: object): void };
export type MapMarker = HTMLElement & {
  map: unknown;
  zIndex?: number | null;
};

// Minimal runtime boundary: the Maps SDK is loaded only when the map view mounts.
export type MapsSDK = {
  Map: new (
    el: HTMLElement,
    options: object,
  ) => {
    fitBounds(bounds: unknown, padding?: number): void;
    panTo(position: Coordinate): void;
    setCenter(position: Coordinate): void;
    getCenter(): { lat(): number; lng(): number } | undefined;
    getBounds(): { contains(point: Coordinate): boolean } | undefined;
    setZoom(zoom: number): void;
    getZoom(): number | undefined;
    setOptions(options: object): void;
    addListener(event: string, fn: () => void): { remove(): void };
  };
  LatLngBounds: new () => { extend(point: object): void; isEmpty(): boolean };
  event: {
    addListenerOnce(instance: unknown, event: string, fn: () => void): { remove(): void };
  };
  marker: {
    // Advanced markers are custom elements, so they take DOM events.
    // addListener still works but Google warns it is going away.
    AdvancedMarkerElement: new (options: object) => MapMarker;
  };
  Polyline: new (options: object) => MapPolyline;
  geometry: { encoding: { decodePath(value: string): Coordinate[] } };
};

export type MapRuntime = { maps: MapsSDK; map: InstanceType<MapsSDK["Map"]> };

let sdk: Promise<MapsSDK> | undefined;

export function loadMaps() {
  if (sdk) return sdk;
  sdk = new Promise<MapsSDK>((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      reject(new Error("Map unavailable: configure the browser Google Maps key."));
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
      reject(new Error("Google Maps took too long to load. Check your connection and retry."));
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
      reject(new Error("Google Maps could not load. Check your connection and retry."));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    sdk = undefined;
    throw error;
  });
  return sdk;
}

/**
 * Adapt a Google map to the SDK-free framing controller. Programmatic moves are flagged until
 * the map is idle again, so only real user interaction counts as "the user moved the map".
 */
export function framable(runtime: MapRuntime, moving: { current: boolean }): FramableMap {
  const { maps, map } = runtime;
  const settle = () => {
    moving.current = true;
    maps.event.addListenerOnce(map, "idle", () => {
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
      maps.event.addListenerOnce(map, "idle", () => map.setOptions({ maxZoom: null }));
    },
  };
}
