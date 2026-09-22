"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GooglePlace, RouteResult } from "@/lib/integrations/google";
import { MapViewController, type FramableMap } from "@/lib/map/map-view";

type Coordinate = { lat: number; lng: number };

// Minimal runtime boundary: the Maps SDK is loaded only when this view mounts.
type MapsSDK = {
  Map: new (
    el: HTMLElement,
    options: object,
  ) => {
    fitBounds(bounds: unknown, padding?: number): void;
    panTo(position: Coordinate): void;
    setCenter(position: Coordinate): void;
    getCenter(): { lat(): number; lng(): number } | undefined;
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
    AdvancedMarkerElement: new (options: object) => {
      map: unknown;
      // Advanced markers are custom elements, so they take DOM events.
      // addListener still works but Google warns it is going away.
      addEventListener(event: string, fn: () => void): void;
      removeEventListener(event: string, fn: () => void): void;
    };
  };
  Polyline: new (options: object) => { setMap(map: unknown): void };
  geometry: { encoding: { decodePath(value: string): unknown } };
};

type MapRuntime = { maps: MapsSDK; map: InstanceType<MapsSDK["Map"]> };
type LocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; position: Coordinate; message: string }
  | { status: "error"; message: string };

const markerColors = ["#345948", "#9b5d32", "#315d80", "#7b4b91", "#8a6a16"];

let sdk: Promise<MapsSDK> | undefined;

function loadMaps() {
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

function coordinate(place: GooglePlace): Coordinate | undefined {
  if (!place.location) return undefined;
  return { lat: place.location.latitude, lng: place.location.longitude };
}

function positions(places: GooglePlace[]) {
  return places.flatMap((place) => coordinate(place) ?? []);
}

/**
 * Adapt a Google map to the SDK-free framing controller. Programmatic moves are flagged until
 * the map is idle again, so only real user interaction counts as "the user moved the map".
 */
function framable(runtime: MapRuntime, moving: { current: boolean }): FramableMap {
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

function geolocationError(error: GeolocationPositionError) {
  if (error.code === 1)
    return "Location permission was denied. You can retry after allowing it in your browser settings.";
  if (error.code === 2)
    return "Your current location is unavailable. Check your device settings and retry.";
  if (error.code === 3) return "Finding your location timed out. Please retry.";
  return "Your current location could not be found. Please retry.";
}

function placeName(place: GooglePlace) {
  return place.displayName?.text ?? place.formattedAddress ?? "Activity";
}

export function TripMap({
  places,
  selected,
  onSelect,
  routes,
  mode = "WALK",
  viewKey,
  destinations = [],
}: {
  places: GooglePlace[];
  /** Destination city places; the map centres on them before any activity is mapped. */
  destinations?: GooglePlace[];
  selected?: string;
  onSelect(id: string): void;
  routes: RouteResult[];
  mode?: "WALK" | "TRANSIT";
  /** Trip identity and destination: changing it reframes the map once for the new trip. */
  viewKey?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const view = useRef<MapViewController | null>(null);
  const moving = useRef(false);
  const userLocationCentered = useRef(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [runtime, setRuntime] = useState<MapRuntime>();
  const [location, setLocation] = useState<LocationState>({ status: "idle" });
  const [nearbyRoute, setNearbyRoute] = useState<
    RouteResult | { status: "loading" } | { status: "error"; error: string }
  >();
  const routeRequest = useRef<AbortController | null>(null);
  const initialFocus = useRef(destinations.length ? destinations : places);
  initialFocus.current = destinations.length ? destinations : places;
  const mappedPlaces = places.filter((place) => coordinate(place));

  // A route estimate belongs to one selected place; never show it for another.
  useEffect(() => {
    routeRequest.current?.abort();
    routeRequest.current = null;
    setNearbyRoute(undefined);
  }, [selected, viewKey]);
  useEffect(() => () => routeRequest.current?.abort(), []);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let disposed = false;
    const listeners: { remove(): void }[] = [];
    setError("");
    setLoading(true);
    void loadMaps()
      .then((maps) => {
        if (disposed || !root.current) return;
        const start = positions(initialFocus.current)[0];
        const map = new maps.Map(root.current, {
          // Created only once the trip has somewhere to show, never as a tiled world map.
          center: start ?? { lat: 0, lng: 0 },
          zoom: start ? 12 : 3,
          // Our map controls sit top-left; Google's map-type toggle would be hidden beneath
          // them, and browser fullscreen would cover the workspace top bar.
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        });
        const next = { maps, map };
        view.current = new MapViewController(framable(next, moving));
        const userMoved = () => {
          if (!moving.current) view.current?.markUserMoved();
        };
        listeners.push(
          map.addListener("dragstart", () => view.current?.markUserMoved()),
          map.addListener("zoom_changed", userMoved),
          map.addListener("center_changed", userMoved),
        );
        setRuntime(next);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          setError(cause instanceof Error ? cause.message : "Google Maps could not load.");
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      listeners.forEach((listener) => listener.remove());
      view.current = null;
      setRuntime(undefined);
    };
  }, [retry]);

  // Frame the trip: destination first, then its places once. Never on unrelated re-renders.
  const destinationKey = destinations.map((place) => place.id).join("|");
  const placesKey = mappedPlaces.map((place) => place.id).join("|");
  useEffect(() => {
    if (!runtime || !view.current) return;
    view.current.update({
      key: viewKey ?? "",
      destinations: positions(destinations),
      places: positions(mappedPlaces),
    });
    // Keyed by identities so new array instances with the same places do not reframe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, viewKey, destinationKey, placesKey]);

  // Sidebar and drawer animations resize the container; keep the centre instead of drifting.
  useEffect(() => {
    const element = root.current;
    if (!runtime || !element || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      const center = runtime.map.getCenter();
      if (!center) return;
      frame = requestAnimationFrame(() => {
        moving.current = true;
        runtime.map.setCenter({ lat: center.lat(), lng: center.lng() });
        runtime.maps.event.addListenerOnce(runtime.map, "idle", () => {
          moving.current = false;
        });
      });
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [runtime]);

  useEffect(() => {
    if (!runtime) return;
    const { maps, map } = runtime;
    const cleanup: (() => void)[] = [];
    let markerIndex = 0;
    places.forEach((place) => {
      const position = coordinate(place);
      if (!position) return;
      const label = String(++markerIndex);
      const content = document.createElement("span");
      content.className = `trip-map-marker${place.id === selected ? " is-selected" : ""}`;
      content.textContent = label;
      content.setAttribute("aria-label", `${label}. ${placeName(place)}`);
      const markerColor = markerColors[(markerIndex - 1) % markerColors.length]!;
      content.style.setProperty("--marker-color", markerColor);
      const marker = new maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: `${label}. ${placeName(place)}`,
        content,
        // Required for gmp-click: an advanced marker is inert until asked to
        // be clickable, unlike the legacy marker it replaced.
        gmpClickable: true,
      });
      // "gmp-click", not addListener("click"): Google warns in the console that
      // the legacy listener on advanced markers is going away.
      const select = () => onSelectRef.current(place.id);
      marker.addEventListener("gmp-click", select);
      cleanup.push(() => {
        marker.removeEventListener("gmp-click", select);
        marker.map = null;
      });
    });
    routes.forEach((route) => {
      if (route.status !== "ok" || !route.polyline) return;
      const line = new maps.Polyline({
        map,
        path: maps.geometry.encoding.decodePath(route.polyline),
        strokeColor: "#345948",
        strokeWeight: 4,
      });
      cleanup.push(() => line.setMap(null));
    });
    return () => cleanup.forEach((fn) => fn());
  }, [runtime, places, selected, routes]);

  useEffect(() => {
    if (!runtime || location.status !== "success") return;
    const content = document.createElement("span");
    content.className = "trip-map-user-marker";
    content.textContent = "●";
    content.setAttribute("aria-label", "Your current location");

    const marker = new runtime.maps.marker.AdvancedMarkerElement({
      map: runtime.map,
      position: location.position,
      title: "Your current location",
      content,
    });
    if (!userLocationCentered.current) {
      // The user asked to see their location: that is a manual move the trip framing respects.
      view.current?.markUserMoved();
      runtime.map.panTo(location.position);
      userLocationCentered.current = true;
    }
    return () => {
      marker.map = null;
    };
  }, [runtime, location]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation({ status: "error", message: "Location is not supported by this browser." });
      return;
    }
    setLocation({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({
          status: "success",
          position: { lat: coords.latitude, lng: coords.longitude },
          message: "Your current location is shown on the map.",
        });
      },
      (cause) => setLocation({ status: "error", message: geolocationError(cause) }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  const locationMessage =
    location.status === "loading"
      ? "Finding your location…"
      : location.status === "success" || location.status === "error"
        ? location.message
        : "";

  const routeFromLocation = useCallback(async () => {
    if (location.status !== "success" || !selected) return;
    routeRequest.current?.abort();
    const controller = new AbortController();
    routeRequest.current = controller;
    setNearbyRoute({ status: "loading" });
    try {
      const response = await fetch("/api/routes/from-location", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: location.position.lat,
          longitude: location.position.lng,
          placeId: selected,
          mode,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Route lookup failed.");
      if (!controller.signal.aborted) setNearbyRoute(body as RouteResult);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setNearbyRoute({
        status: "error",
        error: cause instanceof Error ? cause.message : "Route lookup failed.",
      });
    }
  }, [location, mode, selected]);

  return (
    <section className="trip-map" aria-label="Trip map">
      <div className="trip-map-controls">
        <button
          type="button"
          onClick={() =>
            view.current?.viewAll({
              destinations: positions(destinations),
              places: positions(mappedPlaces),
            })
          }
          disabled={!runtime || (mappedPlaces.length === 0 && destinations.length === 0)}
        >
          View all places
        </button>
        <button type="button" onClick={requestLocation} disabled={location.status === "loading"}>
          {location.status === "loading"
            ? "Finding location…"
            : location.status === "error"
              ? "Retry my location"
              : "Show my location"}
        </button>
        {location.status === "success" && selected && (
          <button
            type="button"
            onClick={() => void routeFromLocation()}
            disabled={nearbyRoute?.status === "loading"}
          >
            {nearbyRoute?.status === "loading" ? "Checking route…" : "Route from my location"}
          </button>
        )}
      </div>
      <div ref={root} className="google-map" aria-label="Google activity map" />
      {loading && <p role="status">Loading Google Maps…</p>}
      {mappedPlaces.length > 0 && (
        <ol className="trip-map-place-list" aria-label="Places shown on the map">
          {mappedPlaces.map((place, index) => (
            <li key={place.id}>
              <button
                type="button"
                aria-pressed={place.id === selected}
                onClick={() => onSelectRef.current(place.id)}
              >
                {index + 1}. {placeName(place)}
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="trip-map-location-status" aria-live="polite">
        {locationMessage}
      </p>
      {nearbyRoute?.status === "ok" && (
        <p className="trip-map-location-status" role="status">
          Google Routes verified · {nearbyRoute.mode === "WALK" ? "Walking" : "Public transit"} ·{" "}
          {nearbyRoute.durationMin} min
          {nearbyRoute.distanceMeters !== undefined
            ? ` · ${(nearbyRoute.distanceMeters / 1000).toFixed(1)} km`
            : " · Distance unavailable"}
        </p>
      )}
      {nearbyRoute?.status === "unavailable" && (
        <p className="trip-map-location-status" role="alert">
          Route could not be verified. {nearbyRoute.error}
        </p>
      )}
      {nearbyRoute?.status === "error" && (
        <p className="trip-map-location-status" role="alert">
          {nearbyRoute.error}
        </p>
      )}
      {error && (
        <div className="trip-map-fallback" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry map
          </button>
          {mappedPlaces.length > 0 && (
            <div aria-label="Mapped places">
              <p>Trip places remain available:</p>
              <ol>
                {mappedPlaces.map((place) => (
                  <li key={place.id}>
                    <button type="button" onClick={() => onSelectRef.current(place.id)}>
                      {placeName(place)}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
