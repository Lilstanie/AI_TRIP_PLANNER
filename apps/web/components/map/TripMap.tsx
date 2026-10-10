"use client";
import { dataModeHeaders } from "@/lib/workspace/data-mode";
import { useLocale } from "@/components/account/LocaleProvider";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GooglePlace, RouteResult } from "@/lib/integrations/google";
import { errorNotice, failureNotice, NoticeError, type Notice } from "@/lib/i18n/notice";
import { MapViewController } from "@/lib/map/map-view";
import { dayRoutes, type RouteStop } from "@/lib/map/itinerary-route";
import { PlacePreview } from "./PlacePreview";
import { framable, type MapMarker, type MapRuntime } from "./google-maps-sdk";
import {
  declutterLabels,
  drawItineraryRoutes,
  markerContent,
  markerTitle,
  placeName,
  routeColors,
} from "./map-layers";
import type { UserLocation } from "./useUserLocation";
import { LayersIcon, LocateIcon, MinusIcon, PlusIcon } from "../ui/icons";
import { useSettings } from "../account/SettingsProvider";

import { loadRenderer } from "./map-renderer";

type Coordinate = { lat: number; lng: number };

export type MapStop = { place: GooglePlace; number: number; day?: number };

const LABEL_ZOOM = 12;

function coordinate(place: GooglePlace): Coordinate | undefined {
  if (!place.location) return undefined;
  return { lat: place.location.latitude, lng: place.location.longitude };
}

function positions(places: GooglePlace[]) {
  return places.flatMap((place) => coordinate(place) ?? []);
}

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
  mockData = false,
  forceOsmProvider = false,
  allowOsmFallback = true,
  stops,
  selected,
  onSelect,
  routes,
  mode = "WALK",
  viewKey,
  destinations = [],
  showPhotos = false,
  userLocation,
  phone = false,
  focusRequest,
}: {
  mockData?: boolean;
  forceOsmProvider?: boolean;
  allowOsmFallback?: boolean;

  stops: MapStop[];
  phone?: boolean;

  focusRequest?: number;

  destinations?: GooglePlace[];
  selected?: string;
  onSelect(id: string): void;
  routes: RouteResult[];
  mode?: "WALK" | "TRANSIT";

  viewKey?: string;

  showPhotos?: boolean;
  userLocation: UserLocation;
}) {
  const { t, locale, notice: localizeNotice } = useLocale();
  const root = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const view = useRef<MapViewController | null>(null);
  const moving = useRef(false);
  const panOnLocate = useRef(false);
  const markers = useRef(new Map<string, { marker: MapMarker; content: HTMLElement }>());
  const popup = useRef<HTMLDivElement>(null);
  const focusPopup = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<Notice>();
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [forceOsm, setForceOsm] = useState(false);
  const [runtime, setRuntime] = useState<MapRuntime>();
  const [closedFor, setClosedFor] = useState<string>();
  const [satellite, setSatellite] = useState(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");

  const { appearance } = useSettings().settings;
  const dark = appearance === "system" ? systemDark : appearance === "dark";
  const { location, request: requestLocation } = userLocation;
  const [nearbyRoute, setNearbyRoute] = useState<
    RouteResult | { status: "loading" } | { status: "error"; notice: Notice }
  >();
  const routeRequest = useRef<AbortController | null>(null);
  const mapped = useMemo(() => stops.filter((stop) => coordinate(stop.place)), [stops]);
  const mappedPlaces = useMemo(() => mapped.map((stop) => stop.place), [mapped]);
  const initialFocus = useRef(destinations.length ? destinations : mappedPlaces);
  initialFocus.current = destinations.length ? destinations : mappedPlaces;
  const selectedStop = mapped.find((stop) => stop.place.id === selected);
  const focusDay = selectedStop?.day;
  const popupOpen = !!selectedStop && closedFor !== selected;

  useEffect(() => {
    if (focusRequest !== undefined) setClosedFor(undefined);
  }, [focusRequest]);

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
    if (popup.current?.contains(document.activeElement)) {
      const restore = () =>
        (target?.isConnected && target.getClientRects().length
          ? target
          : phone
            ? (root.current
                ?.closest(".workspace-panel--map")
                ?.querySelector<HTMLButtonElement>(".phone-map-sheet__handle") ?? root.current)
            : root.current
        )?.focus?.();

      if (phone) requestAnimationFrame(restore);
      else restore();
    }
  }, [selected, phone]);
  const closeRef = useRef(closePopup);
  closeRef.current = closePopup;

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
    setError(undefined);
    setLoading(true);
    let created: MapRuntime | undefined;
    const host = window as unknown as { gm_authFailure?: () => void };
    const previousAuthFailure = host.gm_authFailure;
    host.gm_authFailure = () => {
      if (allowOsmFallback) setForceOsm(true);
      else setError({ key: "The map could not load. Try again." });
      previousAuthFailure?.();
    };
    const mock = mockData;
    void loadRenderer(forceOsm || forceOsmProvider, allowOsmFallback)
      .then(({ maps, provider }) => {
        if (disposed || !root.current) return;
        const start = positions(initialFocus.current)[0];
        const map = new maps.Map(root.current, {
          dark,
          mock,
          center: start ?? { lat: 0, lng: 0 },
          zoom: start ? 12 : 3,

          disableDefaultUI: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          cameraControl: false,

          gestureHandling: "greedy",
          colorScheme: "FOLLOW_SYSTEM",
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        });
        const next = { maps, map, provider };
        created = next;
        root.current.dataset.provider = provider;
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
          map.addListener("error", () => setError({ key: "The map could not load. Try again." })),
          map.addListener("dragstart", () => view.current?.markUserMoved()),
          map.addListener("zoom_changed", () => {
            userMoved();
            labels();
          }),
          map.addListener("center_changed", userMoved),
          map.addListener("idle", () => declutterRef.current()),

          map.addListener("click", () => closeRef.current()),
        );
        setRuntime(next);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          setError(errorNotice(cause, { key: "The map could not load. Try again." }));
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      listeners.forEach((listener) => listener.remove());
      created?.map.destroy?.();
      host.gm_authFailure = previousAuthFailure;
      view.current = null;
      setRuntime(undefined);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry, forceOsm, forceOsmProvider, mockData, allowOsmFallback]);

  useEffect(() => {
    if (runtime?.provider === "osm") runtime.map.setOptions({ dark });
  }, [runtime, dark]);

  const destinationKey = destinations.map((place) => place.id).join("|");
  const placesKey = mappedPlaces.map((place) => place.id).join("|");
  useEffect(() => {
    if (!runtime || !view.current) return;
    view.current.update({
      key: viewKey ?? "",
      destinations: positions(destinations),
      places: positions(mappedPlaces),
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, viewKey, destinationKey, placesKey]);

  useEffect(() => {
    const element = root.current;
    if (!runtime || !element || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      const center = runtime.map.getCenter();
      if (!center) return;
      frame = requestAnimationFrame(() => {
        runtime.map.resize?.();
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

  useEffect(() => {
    if (!runtime) return;
    const { maps, map } = runtime;
    const created = markers.current;
    mapped.forEach((stop) => {
      const position = coordinate(stop.place)!;
      const content = markerContent(stop.place, stop.number, stop.day);
      const marker = new maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: markerTitle(stop.place, stop.number, stop.day, locale),
        content,

        gmpClickable: true,
      });

      const select = () => {
        returnFocus.current = marker;
        focusPopup.current = true;
        setClosedFor(undefined);
        onSelectRef.current(stop.place.id);
      };
      marker.addEventListener("gmp-click", select);

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
  }, [runtime, mapped, locale]);

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

  const lines = useMemo(
    () =>
      dayRoutes(
        mapped.map((stop): RouteStop => ({
          placeId: stop.place.id,
          day: stop.day,
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
  }, [runtime, lines, routes, focusDay, reducedMotion, dark]);

  useEffect(() => {
    const position = selectedStop && coordinate(selectedStop.place);
    if (!runtime || !position || (!phone && runtime.map.getBounds()?.contains(position) !== false))
      return;
    moving.current = true;
    if (reducedMotion) runtime.map.setCenter(position);
    else runtime.map.panTo(position);
    runtime.maps.event.addListenerOnce(runtime.map, "idle", () => {
      moving.current = false;
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, selected, focusRequest]);

  useEffect(() => {
    if (!popupOpen || (!focusPopup.current && !phone)) return;
    focusPopup.current = false;

    const timer = window.setTimeout(() => popup.current?.focus());
    return () => window.clearTimeout(timer);
  }, [popupOpen, selected, phone, focusRequest]);

  useEffect(() => {
    if (!runtime || location.status !== "success") return;
    const content = document.createElement("span");
    content.className = "trip-map-user-marker";
    content.textContent = "●";
    content.setAttribute("aria-label", t("Your current location"));

    const marker = new runtime.maps.marker.AdvancedMarkerElement({
      map: runtime.map,
      position: location.position,
      title: t("Your current location"),
      content,
    });
    if (panOnLocate.current) {
      view.current?.markUserMoved();
      runtime.map.panTo(location.position);
      panOnLocate.current = false;
    }
    return () => {
      marker.map = null;
    };
  }, [runtime, location, t]);

  const showMyLocation = useCallback(() => {
    if (runtime && location.status === "success") {
      view.current?.markUserMoved();
      runtime.map.panTo(location.position);
      if ((runtime.map.getZoom() ?? 0) < 14) runtime.map.setZoom(14);
      return;
    }
    panOnLocate.current = true;
    requestLocation();
  }, [runtime, location, requestLocation]);

  const zoomBy = useCallback(
    (step: number) => {
      if (!runtime) return;
      runtime.map.setZoom((runtime.map.getZoom() ?? 12) + step);
    },
    [runtime],
  );

  const toggleSatellite = useCallback(() => {
    if (!runtime) return;
    const next = !satellite;
    runtime.map.setMapTypeId(next ? "hybrid" : "roadmap");
    setSatellite(next);
  }, [runtime, satellite]);

  const locationMessage: Notice | undefined =
    location.status === "loading"
      ? { key: "Finding your location…" }
      : location.status === "success" || location.status === "error"
        ? location.message
        : undefined;

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
        headers: {
          "Content-Type": "application/json",
          ...dataModeHeaders(mockData ? "mock" : "live"),
        },
        body: JSON.stringify({
          latitude: location.position.lat,
          longitude: location.position.lng,
          placeId: selected,
          toLocation: selectedStop?.place.location,
          mode,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new NoticeError(failureNotice(body, { key: "Route lookup failed." }));
      if (!controller.signal.aborted) setNearbyRoute(body as RouteResult);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setNearbyRoute({
        status: "error",
        notice: errorNotice(cause, { key: "Route lookup failed." }),
      });
    }
  }, [location, mode, selected, selectedStop, mockData]);

  return (
    <section
      className="trip-map"
      aria-label={t("Trip map")}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !popupOpen) return;
        event.stopPropagation();
        closePopup();
      }}
    >
      <div ref={root} className="google-map" aria-label={t("Trip map")} tabIndex={-1} />
      {loading && <p role="status">{t("Loading map…")}</p>}
      {popupOpen && selectedStop && (
        <div
          ref={popup}
          className={phone ? "trip-map-popup phone-map-details" : "trip-map-popup"}
          role="dialog"
          aria-labelledby="trip-map-popup-title"
          tabIndex={-1}
        >
          <PlacePreview
            key={selectedStop.place.id}
            place={selectedStop.place}
            showPhoto={showPhotos}
            headingId="trip-map-popup-title"
            meta={`${t("Stop")} ${selectedStop.number}${selectedStop.day ? ` · ${t("Day {v0}", { v0: selectedStop.day })}` : ""}`}
            onClose={closePopup}
            actions={
              location.status === "success" && (
                <button
                  type="button"
                  onClick={() => void routeFromLocation()}
                  disabled={nearbyRoute?.status === "loading"}
                >
                  {nearbyRoute?.status === "loading"
                    ? t("Checking route…")
                    : t("Route from my location")}
                </button>
              )
            }
          />
        </div>
      )}
      <div className="map-controls" role="group" aria-label={t("Map controls")}>
        <button
          type="button"
          className="map-control"
          aria-label={
            location.status === "loading"
              ? t("Finding your location")
              : location.status === "error"
                ? t("Retry my location")
                : t("Show my location")
          }
          data-tooltip-left={t(location.status === "error" ? "Retry my location" : "My location")}
          aria-busy={location.status === "loading" || undefined}
          data-active={location.status === "success" || undefined}
          onClick={showMyLocation}
        >
          <LocateIcon filled={location.status === "success"} />
        </button>
        <button
          type="button"
          className="map-control"
          aria-label={t("Satellite view")}
          aria-pressed={satellite}
          data-tooltip-left={t(satellite ? "Map view" : "Satellite view")}
          onClick={toggleSatellite}
          disabled={!runtime || runtime.provider === "osm"}
        >
          <LayersIcon />
        </button>
        <div className="map-control-group">
          <button
            type="button"
            className="map-control"
            aria-label={t("Zoom in")}
            onClick={() => zoomBy(1)}
            disabled={!runtime}
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="map-control"
            aria-label={t("Zoom out")}
            onClick={() => zoomBy(-1)}
            disabled={!runtime}
          >
            <MinusIcon />
          </button>
        </div>
      </div>
      <p
        className="trip-map-location-status"
        data-quiet={location.status === "success" || undefined}
        aria-live="polite"
      >
        {localizeNotice(locationMessage)}
      </p>
      {nearbyRoute?.status === "ok" && (
        <p className="trip-map-location-status" role="status">
          {nearbyRoute.source === "transitous" ? (
            <a href="https://transitous.org/sources/" target="_blank" rel="noreferrer">
              Transitous ·
            </a>
          ) : nearbyRoute.source === "osrm" ? (
            t("OSRM routes ·")
          ) : (
            t("Google Routes verified ·")
          )}
          {nearbyRoute.mode === "WALK" ? t("Walking") : t("Public transit")} ·{" "}
          {nearbyRoute.durationMin} {t("min")}
          {nearbyRoute.distanceMeters !== undefined
            ? ` · ${(nearbyRoute.distanceMeters / 1000).toFixed(1)} km`
            : t(" · Distance unavailable")}
        </p>
      )}
      {nearbyRoute?.status === "unavailable" && (
        <p className="trip-map-location-status" role="alert">
          {t("Route could not be verified.")}
          {localizeNotice(
            nearbyRoute.notice ?? (nearbyRoute.error ? { raw: nearbyRoute.error } : undefined),
          )}
        </p>
      )}
      {nearbyRoute?.status === "error" && (
        <p className="trip-map-location-status" role="alert">
          {localizeNotice(nearbyRoute.notice)}
        </p>
      )}
      {error && (
        <div className="trip-map-fallback" role="alert">
          <p>{localizeNotice(error)}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {t("Retry map")}
          </button>
          {mapped.length > 0 && (
            <div aria-label={t("Mapped places")}>
              <p>{t("Trip places remain available:")}</p>
              <ol>
                {mapped.map((stop) => (
                  <li key={stop.place.id}>
                    <button
                      type="button"
                      onClick={(event) => {
                        returnFocus.current = event.currentTarget;
                        focusPopup.current = true;
                        setClosedFor(undefined);
                        onSelectRef.current(stop.place.id);
                      }}
                    >
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
