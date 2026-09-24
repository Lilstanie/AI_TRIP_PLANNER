"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GooglePlace, RouteResult } from "@/lib/integrations/google";
import { MapViewController } from "@/lib/map/map-view";
import { dayRoutes, type RouteStop } from "@/lib/map/itinerary-route";
import { PlacePreview } from "./PlacePreview";
import { framable, loadMaps, type MapMarker, type MapRuntime } from "./google-maps-sdk";
import {
  declutterLabels,
  drawItineraryRoutes,
  markerContent,
  markerTitle,
  placeName,
  routeColors,
} from "./map-layers";
import type { UserLocation } from "./useUserLocation";

type Coordinate = { lat: number; lng: number };

/** A located itinerary stop. `order` is its 1-based number across the trip, in visiting order. */
export type MapStop = { place: GooglePlace; order: number; day?: number };

/** Below this zoom only the selected marker keeps its name label, so labels do not pile up. */
const LABEL_ZOOM = 12;

function coordinate(place: GooglePlace): Coordinate | undefined {
  if (!place.location) return undefined;
  return { lat: place.location.latitude, lng: place.location.longitude };
}

function positions(places: GooglePlace[]) {
  return places.flatMap((place) => coordinate(place) ?? []);
}

/** Follow a media query without per-frame state; false where matchMedia is unavailable. */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener?.("change", update);
    return () => list.removeEventListener?.("change", update);
  }, [query]);
  return matches;
}

export function TripMap({
  stops,
  selected,
  onSelect,
  routes,
  mode = "WALK",
  viewKey,
  destinations = [],
  showPhotos = false,
  userLocation,
}: {
  /** Located stops in visiting order; each becomes a labelled marker. */
  stops: MapStop[];
  /** Destination city places; the map centres on them before any activity is mapped. */
  destinations?: GooglePlace[];
  selected?: string;
  onSelect(id: string): void;
  routes: RouteResult[];
  mode?: "WALK" | "TRANSIT";
  /** Trip identity and destination: changing it reframes the map once for the new trip. */
  viewKey?: string;
  /** Load Google place photos. Only in live data mode: every image is billed. */
  showPhotos?: boolean;
  userLocation: UserLocation;
}) {
  const root = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const view = useRef<MapViewController | null>(null);
  const moving = useRef(false);
  const panOnLocate = useRef(false);
  const markers = useRef(new Map<string, { marker: MapMarker; content: HTMLElement }>());
  const popup = useRef<HTMLDivElement>(null);
  const focusPopup = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [runtime, setRuntime] = useState<MapRuntime>();
  const [closedFor, setClosedFor] = useState<string>();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const dark = useMediaQuery("(prefers-color-scheme: dark)");
  const { location, request: requestLocation } = userLocation;
  const [nearbyRoute, setNearbyRoute] = useState<
    RouteResult | { status: "loading" } | { status: "error"; error: string }
  >();
  const routeRequest = useRef<AbortController | null>(null);
  const mapped = useMemo(() => stops.filter((stop) => coordinate(stop.place)), [stops]);
  const mappedPlaces = useMemo(() => mapped.map((stop) => stop.place), [mapped]);
  const initialFocus = useRef(destinations.length ? destinations : mappedPlaces);
  initialFocus.current = destinations.length ? destinations : mappedPlaces;
  const selectedStop = mapped.find((stop) => stop.place.id === selected);
  const focusDay = selectedStop?.day;
  const popupOpen = !!selectedStop && closedFor !== selected;

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

  const closePopup = useCallback(() => {
    setClosedFor(selected);
    const target = returnFocus.current;
    returnFocus.current = null;
    if (popup.current?.contains(document.activeElement))
      (target?.isConnected ? target : root.current)?.focus?.();
  }, [selected]);
  const closeRef = useRef(closePopup);
  closeRef.current = closePopup;

  // Measure labels shortly after a change: Google attaches and positions marker content in its own
  // render pass, a frame or more after the marker is created.
  const declutterTimer = useRef<number | undefined>(undefined);
  const declutterRef = useRef((attempt = 0) => {
    window.clearTimeout(declutterTimer.current);
    declutterTimer.current = window.setTimeout(() => {
      const contents = [...markers.current.values()].map(({ content }) => content);
      if (!declutterLabels(contents) && contents.length && attempt < 8)
        declutterRef.current(attempt + 1);
    }, 150);
  });
  useEffect(() => () => window.clearTimeout(declutterTimer.current), []);

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
          colorScheme: "FOLLOW_SYSTEM",
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        });
        const next = { maps, map };
        view.current = new MapViewController(framable(next, moving));
        const userMoved = () => {
          if (!moving.current) view.current?.markUserMoved();
        };
        const labels = () => {
          if (root.current)
            root.current.dataset.labels = (map.getZoom() ?? 0) >= LABEL_ZOOM ? "all" : "selected";
        };
        labels();
        listeners.push(
          map.addListener("dragstart", () => view.current?.markUserMoved()),
          map.addListener("zoom_changed", () => {
            userMoved();
            labels();
          }),
          map.addListener("center_changed", userMoved),
          map.addListener("idle", () => declutterRef.current()),
          // A press on the map itself dismisses the place popup, as on other map apps.
          map.addListener("click", () => closeRef.current()),
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
        // A map shown after being hidden (the phone Chat/Map switch) lays its labels out now.
        declutterRef.current();
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

  // Labelled markers, created once per set of stops; selection only restyles them below.
  useEffect(() => {
    if (!runtime) return;
    const { maps, map } = runtime;
    const created = markers.current;
    mapped.forEach((stop) => {
      const position = coordinate(stop.place)!;
      const content = markerContent(stop.place, stop.order, stop.day);
      const marker = new maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: markerTitle(stop.place, stop.order, stop.day),
        content,
        // Required for gmp-click: an advanced marker is inert until asked to
        // be clickable, unlike the legacy marker it replaced.
        gmpClickable: true,
      });
      // "gmp-click", not addListener("click"): Google warns in the console that
      // the legacy listener on advanced markers is going away.
      const select = () => {
        returnFocus.current = marker;
        focusPopup.current = true;
        setClosedFor(undefined);
        onSelectRef.current(stop.place.id);
      };
      marker.addEventListener("gmp-click", select);
      // The name label hangs outside the marker's own hit area, so it listens for itself and
      // keeps the press from reaching the map, which would close the popup again.
      content.querySelector(".trip-map-marker__label")?.addEventListener("click", (event) => {
        event.stopPropagation();
        select();
      });
      created.set(stop.place.id, { marker, content });
    });
    return () => {
      created.forEach(({ marker }) => {
        marker.map = null;
      });
      created.clear();
    };
  }, [runtime, mapped]);

  useEffect(() => {
    markers.current.forEach(({ marker, content }, placeId) => {
      const isSelected = placeId === selected;
      const day = content.dataset.day ? Number(content.dataset.day) : undefined;
      content.classList.toggle("is-selected", isSelected);
      content.classList.toggle("is-muted", focusDay !== undefined && day !== focusDay);
      marker.zIndex = isSelected ? 1000 : focusDay !== undefined && day === focusDay ? 10 : 1;
    });
    declutterRef.current();
  }, [runtime, mapped, selected, focusDay]);

  // Itinerary lines: one per day, the focused day's dashes flowing in visiting order.
  const lines = useMemo(
    () =>
      dayRoutes(
        mapped.map((stop): RouteStop => ({
          placeId: stop.place.id,
          day: stop.day,
          order: stop.order,
          position: coordinate(stop.place)!,
        })),
        routes,
      ),
    [mapped, routes],
  );
  useEffect(() => {
    if (!runtime || !root.current) return;
    return drawItineraryRoutes({
      runtime,
      lines,
      routes,
      focusDay,
      colors: routeColors(root.current),
      reducedMotion,
    });
    // `dark` re-reads the token colours when the theme changes.
  }, [runtime, lines, routes, focusDay, reducedMotion, dark]);

  // A place chosen elsewhere (the Trip drawer) is brought into view if it is off the map. This is a
  // programmatic move, so it does not count as the traveller moving the map.
  useEffect(() => {
    const position = selectedStop && coordinate(selectedStop.place);
    if (!runtime || !position || runtime.map.getBounds()?.contains(position) !== false) return;
    moving.current = true;
    runtime.map.panTo(position);
    runtime.maps.event.addListenerOnce(runtime.map, "idle", () => {
      moving.current = false;
    });
    // Only on a new selection, not when the stop list is rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, selected]);

  // Selecting a new place reopens its popup; a marker press also moves focus into it.
  useEffect(() => {
    if (!popupOpen || !focusPopup.current) return;
    focusPopup.current = false;
    // After the marker's own key handling, which otherwise keeps focus on the marker.
    const timer = window.setTimeout(() => popup.current?.focus());
    return () => window.clearTimeout(timer);
  }, [popupOpen, selected]);

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
    if (panOnLocate.current) {
      // The user asked to see their location: that is a manual move the trip framing respects.
      view.current?.markUserMoved();
      runtime.map.panTo(location.position);
      panOnLocate.current = false;
    }
    return () => {
      marker.map = null;
    };
  }, [runtime, location]);

  const showMyLocation = useCallback(() => {
    panOnLocate.current = true;
    requestLocation();
  }, [requestLocation]);

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
    <section
      className="trip-map"
      aria-label="Trip map"
      onKeyDown={(event) => {
        // Escape closes the place popup from inside it or from the marker that opened it.
        if (event.key !== "Escape" || !popupOpen) return;
        event.stopPropagation();
        closePopup();
      }}
    >
      <div className="trip-map-controls">
        <button
          type="button"
          onClick={() =>
            view.current?.viewAll({
              destinations: positions(destinations),
              places: positions(mappedPlaces),
            })
          }
          disabled={!runtime || (mapped.length === 0 && destinations.length === 0)}
        >
          View all places
        </button>
        <button type="button" onClick={showMyLocation} disabled={location.status === "loading"}>
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
      <div ref={root} className="google-map" aria-label="Google activity map" tabIndex={-1} />
      {loading && <p role="status">Loading Google Maps…</p>}
      {popupOpen && selectedStop && (
        <div
          ref={popup}
          className="trip-map-popup"
          role="dialog"
          aria-labelledby="trip-map-popup-title"
          tabIndex={-1}
        >
          <PlacePreview
            key={selectedStop.place.id}
            place={selectedStop.place}
            showPhoto={showPhotos}
            headingId="trip-map-popup-title"
            meta={`Stop ${selectedStop.order}${selectedStop.day ? ` · Day ${selectedStop.day}` : ""}`}
            onClose={closePopup}
          />
        </div>
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
          {mapped.length > 0 && (
            <div aria-label="Mapped places">
              <p>Trip places remain available:</p>
              <ol>
                {mapped.map((stop) => (
                  <li key={stop.place.id}>
                    <button type="button" onClick={() => onSelectRef.current(stop.place.id)}>
                      {placeName(stop.place)}
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
