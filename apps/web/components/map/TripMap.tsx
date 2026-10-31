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
import { hoveredStop, hoverStop, subscribeStopHover } from "@/lib/trip/stop-hover";
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

export type MapStop = { activityId: string; place: GooglePlace; number: number; day?: number };

const LABEL_ZOOM = 12;
const HOME_ZOOM = 9;
const WORLD_ZOOM = 2;

function coordinate(place: GooglePlace): Coordinate | undefined {
  if (!place.location) return undefined;
  return { lat: place.location.latitude, lng: place.location.longitude };
}

function positions(places: GooglePlace[]) {
  return places.flatMap((place) => coordinate(place) ?? []);
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches,
  );
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
  visible = true,
  focusRequest,
  quiet = false,
  center,
}: {
  quiet?: boolean;
  center?: Coordinate;
  mockData?: boolean;
  forceOsmProvider?: boolean;
  allowOsmFallback?: boolean;

  stops: MapStop[];
  phone?: boolean;
  visible?: boolean;

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
  const runtimeRef = useRef<MapRuntime | undefined>(undefined);
  const cleanups = useRef<Set<() => void>>(new Set());
  const onSelectRef = useRef(onSelect);
  const view = useRef<MapViewController | null>(null);
  const moving = useRef(false);
  const panOnLocate = useRef(false);
  const markers = useRef(
    new Map<string, { marker: MapMarker; content: HTMLElement; activityId: string }>(),
  );
  const routeLayer = useRef<ReturnType<typeof drawItineraryRoutes> | null>(null);
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
  const centerRef = useRef(center);
  centerRef.current = center;
  const quietRef = useRef(quiet);
  quietRef.current = quiet;
  const ownCleanup = useCallback((dispose: () => void) => {
    let active = true;
    const cleanup = () => {
      if (!active) return;
      active = false;
      cleanups.current.delete(cleanup);
      dispose();
    };
    cleanups.current.add(cleanup);
    return cleanup;
  }, []);
  const runCleanups = useCallback(() => {
    for (const cleanup of [...cleanups.current]) cleanup();
  }, []);
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
    const element = root.current;
    if (!element) {
      setLoading(false);
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    setError(undefined);
    setLoading(true);
    const mock = mockData;
    const start = positions(initialFocus.current)[0] ?? centerRef.current;
    const options = {
      dark,
      mock,
      center: start ?? { lat: 0, lng: 0 },
      zoom: positions(initialFocus.current)[0] ? 12 : centerRef.current ? HOME_ZOOM : WORLD_ZOOM,

      disableDefaultUI: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      cameraControl: false,

      gestureHandling: "greedy",
      colorScheme: "FOLLOW_SYSTEM",
      mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
    };
    const removeRenderer = () => {
      const active = runtimeRef.current;
      runtimeRef.current = undefined;
      runCleanups();
      active?.dispose();
      view.current = null;
      delete element.dataset.provider;
      delete element.dataset.mapReady;
      delete element.dataset.mapDegraded;
      delete element.dataset.labels;
    };
    const fail = (cause: unknown, provider?: "google" | "osm") => {
      if (disposed) return;
      removeRenderer();
      setRuntime(undefined);
      if (provider === "google" && allowOsmFallback && !forceOsm && !forceOsmProvider) {
        setLoading(true);
        setForceOsm(true);
        return;
      }
      if (!quietRef.current) setError(errorNotice(cause, { key: "theMapCouldNotLoad" }));
      setLoading(false);
    };
    void loadRenderer(element, options, {
      forceOsm: forceOsm || forceOsmProvider,
      allowFallback: allowOsmFallback,
      signal: controller.signal,
    })
      .then((next) => {
        if (disposed || controller.signal.aborted || element !== root.current) {
          next.dispose();
          return;
        }
        try {
          runtimeRef.current = next;
          element.dataset.provider = next.provider!;
          view.current = new MapViewController(framable(next, moving));
          next.onAuthFailure(() => {
            if (disposed || runtimeRef.current !== next) return;
            removeRenderer();
            setRuntime(undefined);
            if (allowOsmFallback) {
              setError(undefined);
              setLoading(true);
              setForceOsm(true);
            } else {
              if (!quietRef.current) setError({ key: "theMapCouldNotLoad" });
              setLoading(false);
            }
          });
          const userMoved = () => {
            if (!moving.current) view.current?.markUserMoved();
          };
          const labels = () => {
            element.dataset.labels = (next.map.getZoom() ?? 0) >= LABEL_ZOOM ? "all" : "selected";
          };
          labels();
          next.listen("error", () => {
            element.dataset.mapDegraded = "true";
            if (!quietRef.current) setError({ key: "theMapCouldNotLoad" });
          });
          next.listen("dragstart", () => view.current?.markUserMoved());
          next.listen("zoom_changed", () => {
            userMoved();
            labels();
          });
          next.listen("center_changed", userMoved);
          next.listen("idle", () => {
            if (next.provider === "osm") element.dataset.mapReady = "true";
            declutterRef.current();
          });
          next.listen("click", () => closeRef.current());
          if (runtimeRef.current === next) {
            setRuntime(next);
            setLoading(false);
          }
        } catch (cause) {
          fail(cause, next.provider);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) fail(cause);
      });
    return () => {
      disposed = true;
      controller.abort();
      removeRenderer();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry, forceOsm, forceOsmProvider, mockData, allowOsmFallback]);

  useEffect(() => {
    if (runtime?.provider === "osm") runtime.map.setOptions({ dark });
  }, [runtime, dark]);

  const unfocused = !destinations.length && !mappedPlaces.length;
  const centerLat = center?.lat;
  const centerLng = center?.lng;
  useEffect(() => {
    if (
      !runtime ||
      centerLat === undefined ||
      centerLng === undefined ||
      !unfocused ||
      view.current?.movedByUser
    )
      return;
    moving.current = true;
    runtime.map.setCenter({ lat: centerLat, lng: centerLng });
    runtime.map.setZoom(HOME_ZOOM);
    const settle = runtime.listenOnce("idle", () => {
      moving.current = false;
    });
    return ownCleanup(() => settle.remove());
  }, [runtime, centerLat, centerLng, unfocused, ownCleanup]);

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
    if (!runtime || !element) return;
    let frame = 0;
    let settle: { remove(): void } | undefined;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      const center = runtime.map.getCenter();
      if (!center) return;
      frame = requestAnimationFrame(() => {
        runtime.map.resize?.();
        declutterRef.current();
        moving.current = true;
        runtime.map.setCenter({ lat: center.lat(), lng: center.lng() });
        settle?.remove();
        settle = runtime.listenOnce("idle", () => {
          moving.current = false;
        });
      });
    });
    observer.observe(element);
    return ownCleanup(() => {
      cancelAnimationFrame(frame);
      settle?.remove();
      observer.disconnect();
    });
  }, [runtime, ownCleanup]);

  useEffect(() => {
    if (!runtime) return;
    const { maps, map } = runtime;
    const created = markers.current;
    const markerCleanups: Array<() => void> = [];
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

      const label = content.querySelector<HTMLElement>(".trip-map-marker__label");
      const selectLabel = (event: Event) => {
        event.stopPropagation();
        select();
      };
      label?.addEventListener("click", selectLabel);
      const hover = (event: PointerEvent) => {
        if (event.pointerType === "mouse") hoverStop(stop.activityId);
      };
      const leave = () => hoverStop(undefined);
      content.addEventListener("pointerenter", hover);
      content.addEventListener("pointerleave", leave);
      created.set(stop.place.id, { marker, content, activityId: stop.activityId });
      markerCleanups.push(
        ownCleanup(() => {
          marker.removeEventListener("gmp-click", select);
          label?.removeEventListener("click", selectLabel);
          content.removeEventListener("pointerenter", hover);
          content.removeEventListener("pointerleave", leave);
          marker.map = null;
          if (created.get(stop.place.id)?.marker === marker) created.delete(stop.place.id);
        }),
      );
    });
    return () => markerCleanups.forEach((cleanup) => cleanup());
  }, [runtime, mapped, locale, ownCleanup]);

  useEffect(() => {
    const paint = () => {
      const hovered = hoveredStop();
      markers.current.forEach(({ marker, content, activityId }, placeId) => {
        const isSelected = placeId === selected;
        const isHovered = activityId === hovered;
        const day = content.dataset.day ? Number(content.dataset.day) : undefined;
        content.classList.toggle("is-selected", isSelected);
        content.classList.toggle("is-hovered", isHovered);
        content.classList.toggle("is-muted", focusDay !== undefined && day !== focusDay);
        marker.zIndex = isHovered
          ? 1001
          : isSelected
            ? 1000
            : focusDay !== undefined && day === focusDay
              ? 10
              : 1;
      });
    };
    paint();
    declutterRef.current();
    return subscribeStopHover(paint);
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
    const layer = drawItineraryRoutes({
      runtime,
      lines,
      routes,
      focusDay,
      colors: routeColors(root.current),
      reducedMotion: false,
      animationEnabled: false,
      locale,
    });
    routeLayer.current = layer;
    return ownCleanup(() => {
      layer();
      if (routeLayer.current === layer) routeLayer.current = null;
    });
  }, [runtime, lines, routes, focusDay, dark, locale, ownCleanup]);

  useEffect(() => {
    routeLayer.current?.setAnimationEnabled(visible && !reducedMotion);
  }, [runtime, lines, routes, focusDay, dark, visible, reducedMotion, locale]);

  useEffect(() => {
    const position = selectedStop && coordinate(selectedStop.place);
    if (!runtime || !position || (!phone && runtime.map.getBounds()?.contains(position) !== false))
      return;
    moving.current = true;
    if (reducedMotion) runtime.map.setCenter(position);
    else runtime.map.panTo(position);
    const settle = runtime.listenOnce("idle", () => {
      moving.current = false;
    });
    return ownCleanup(() => settle.remove());

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, selected, focusRequest, ownCleanup]);

  useEffect(() => {
    if (!popupOpen || (!focusPopup.current && !phone)) return;
    focusPopup.current = false;

    const timer = window.setTimeout(() => popup.current?.focus());
    return ownCleanup(() => window.clearTimeout(timer));
  }, [popupOpen, selected, phone, focusRequest, ownCleanup]);

  useEffect(() => {
    if (!runtime || location.status !== "success") return;
    const content = document.createElement("span");
    content.className = "trip-map-user-marker";
    content.textContent = "●";
    content.setAttribute("aria-label", t("yourCurrentLocation"));

    const marker = new runtime.maps.marker.AdvancedMarkerElement({
      map: runtime.map,
      position: location.position,
      title: t("yourCurrentLocation"),
      content,
    });
    if (panOnLocate.current) {
      view.current?.markUserMoved();
      runtime.map.panTo(location.position);
      panOnLocate.current = false;
    }
    return ownCleanup(() => {
      marker.map = null;
    });
  }, [runtime, location, t, ownCleanup]);

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
      ? { key: "findingYourLocationTitle" }
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
      if (!response.ok) throw new NoticeError(failureNotice(body, { key: "routeLookupFailed" }));
      if (!controller.signal.aborted) setNearbyRoute(body as RouteResult);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setNearbyRoute({
        status: "error",
        notice: errorNotice(cause, { key: "routeLookupFailed" }),
      });
    }
  }, [location, mode, selected, selectedStop, mockData]);

  return (
    <section
      className="trip-map"
      aria-label={t("tripMap")}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !popupOpen) return;
        event.stopPropagation();
        closePopup();
      }}
    >
      <div ref={root} className="google-map" aria-label={t("tripMap")} tabIndex={-1} />
      {loading && !quiet && <p role="status">{t("loadingMap")}</p>}
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
            meta={`${t("stopTitle")} ${selectedStop.number}${selectedStop.day ? ` · ${t("dayV0", { v0: selectedStop.day })}` : ""}`}
            onClose={closePopup}
            actions={
              location.status === "success" && (
                <button
                  type="button"
                  onClick={() => void routeFromLocation()}
                  disabled={nearbyRoute?.status === "loading"}
                >
                  {nearbyRoute?.status === "loading"
                    ? t("checkingRoute")
                    : t("routeFromMyLocation")}
                </button>
              )
            }
          />
        </div>
      )}
      <div className="map-controls" role="group" aria-label={t("mapControls")}>
        <button
          type="button"
          className="map-control"
          aria-label={
            location.status === "loading"
              ? t("findingYourLocation")
              : location.status === "error"
                ? t("retryMyLocation")
                : t("showMyLocation")
          }
          data-tooltip-left={t(location.status === "error" ? "retryMyLocation" : "myLocation")}
          aria-busy={location.status === "loading" || undefined}
          data-active={location.status === "success" || undefined}
          onClick={showMyLocation}
        >
          <LocateIcon filled={location.status === "success"} />
        </button>
        <button
          type="button"
          className="map-control"
          aria-label={t("satelliteView")}
          aria-pressed={satellite}
          data-tooltip-left={t(satellite ? "mapView" : "satelliteView")}
          onClick={toggleSatellite}
          disabled={!runtime || runtime.provider === "osm"}
        >
          <LayersIcon />
        </button>
        <div className="map-control-group">
          <button
            type="button"
            className="map-control"
            aria-label={t("zoomIn")}
            onClick={() => zoomBy(1)}
            disabled={!runtime}
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="map-control"
            aria-label={t("zoomOut")}
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
            t("osrmRoutes")
          ) : (
            t("googleRoutesVerifiedTitle")
          )}
          {nearbyRoute.mode === "WALK" ? t("walking") : t("publicTransit")} ·{" "}
          {nearbyRoute.durationMin} {t("min")}
          {nearbyRoute.distanceMeters !== undefined
            ? ` · ${(nearbyRoute.distanceMeters / 1000).toFixed(1)} km`
            : t("distanceUnavailable")}
        </p>
      )}
      {nearbyRoute?.status === "unavailable" && (
        <p className="trip-map-location-status" role="alert">
          {t("routeCouldNotBeVerified")}
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
            {t("retryMap")}
          </button>
          {mapped.length > 0 && (
            <div aria-label={t("mappedPlaces")}>
              <p>{t("tripPlacesRemainAvailable")}</p>
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
