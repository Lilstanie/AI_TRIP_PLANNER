"use client";
import { NoticeError } from "@/lib/i18n/notice";
import {
  loadMaps,
  googleAuthRejected,
  subscribeGoogleAuthFailure,
  type MapsSDK,
  type MapRuntime,
} from "./google-maps-sdk";

function runtime(
  element: HTMLElement,
  maps: MapsSDK,
  map: InstanceType<MapsSDK["Map"]>,
  provider: "google" | "osm",
): MapRuntime {
  const listeners = new Set<{ remove(): void }>();
  const authListeners = new Set<() => void>();
  let disposed = false;
  const auth =
    provider === "google"
      ? subscribeGoogleAuthFailure(() => {
          if (!disposed) authListeners.forEach((listener) => listener());
        })
      : undefined;
  const track = (handle: { remove(): void } | undefined) => {
    if (!handle) return { remove() {} };
    listeners.add(handle);
    return {
      remove() {
        listeners.delete(handle);
        handle.remove();
      },
    };
  };
  return {
    maps,
    map,
    provider,
    listen(event, fn) {
      return track(map.addListener(event, fn));
    },
    listenOnce(event, fn) {
      let native: { remove(): void } | undefined;
      let active = true;
      const handle = {
        remove() {
          if (!active) return;
          active = false;
          listeners.delete(handle);
          native?.remove();
        },
      };
      native = maps.event.addListenerOnce(map, event, () => {
        if (!active) return;
        active = false;
        listeners.delete(handle);
        fn();
      });
      listeners.add(handle);
      return handle;
    },
    onAuthFailure(fn) {
      if (disposed || provider !== "google") return { remove() {} };
      authListeners.add(fn);
      if (googleAuthRejected())
        queueMicrotask(() => {
          if (authListeners.has(fn)) fn();
        });
      return {
        remove() {
          authListeners.delete(fn);
        },
      };
    },
    removeMarker(marker) {
      if (provider === "google" && googleAuthRejected()) marker.remove();
      else marker.map = null;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.forEach((listener) => listener.remove());
      listeners.clear();
      authListeners.clear();
      auth?.remove();
      map.destroy?.();
      element.remove();
    },
  };
}

function create(
  root: HTMLElement,
  maps: MapsSDK,
  options: object,
  provider: "google" | "osm",
): MapRuntime {
  const element = document.createElement("div");
  element.className = "google-map__renderer";
  root.append(element);
  try {
    return runtime(element, maps, new maps.Map(element, options), provider);
  } catch (error) {
    element.remove();
    throw error;
  }
}

export async function loadRenderer(
  root: HTMLElement,
  options: object,
  settings: { forceOsm?: boolean; allowFallback?: boolean; signal?: AbortSignal } = {},
): Promise<MapRuntime> {
  const { forceOsm = false, allowFallback = true, signal } = settings;
  if (!forceOsm && googleAuthRejected() && !allowFallback)
    throw new NoticeError({ key: "theMapCouldNotLoad" });
  if (!forceOsm && !googleAuthRejected()) {
    try {
      const maps = await loadMaps();
      signal?.throwIfAborted();
      return create(root, maps, options, "google");
    } catch (error) {
      if (signal?.aborted || !allowFallback) throw error;
      root.replaceChildren();
    }
  }
  signal?.throwIfAborted();
  const { mapLibreRenderer } = await import("./maplibre-renderer");
  signal?.throwIfAborted();
  const maps = mapLibreRenderer();
  return create(root, maps, options, "osm");
}
