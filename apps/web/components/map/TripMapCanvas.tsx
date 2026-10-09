"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "../account/LocaleProvider";
import type { RouteResult } from "@/lib/integrations/google";
import type { TripPlaces } from "./useTripPlaces";
import type { UserLocation } from "./useUserLocation";
import { MapPinIcon } from "../ui/icons";

const TripMap = dynamic(() => import("./TripMap").then((m) => m.TripMap), {
  ssr: false,
  loading: MapLoading,
});

function MapLoading() {
  const { t } = useLocale();
  return <p className="trip-map-loading">{t("Loading map…")}</p>;
}

/**
 * The persistent map canvas. It shows only the map, markers, map status and map controls —
 * timelines, editors and trip cards live in the Your Trip drawer.
 *
 * The Google map is created only once the trip has somewhere to show (its destination or an
 * activity place); before that a neutral placeholder is shown instead of a tiled world map.
 */
export function TripMapCanvas({
  destination,
  viewKey,
  tripPlaces,
  selectedActivity,
  onSelectActivity,
  routes,
  showPhotos = false,
  userLocation,
  phone = false,
  focusedDay,
  focusRequest,
}: {
  /** The trip destination, or undefined for a blank conversation. */
  phone?: boolean;
  focusedDay?: number;
  focusRequest?: number;
  destination?: string;
  viewKey?: string;
  tripPlaces: TripPlaces;
  selectedActivity?: string;
  onSelectActivity(id: string): void;
  routes: RouteResult[];
  /** Load Google place photos; only in live data mode, because every image is billed. */
  showPhotos?: boolean;
  /** The traveller's position, shared with the workspace's location question. */
  userLocation: UserLocation;
}) {
  const { t } = useLocale();
  const {
    itinerary,
    destinations,
    destinationsSettled,
    destinationsUnavailable,
    loading,
    unconfirmed,
    unavailable,
    retry,
  } = tripPlaces;
  // A day's map holds that day's visits, so a place seen on an earlier day stays on it (#185).
  const markers = useMemo(() => itinerary.markersFor(focusedDay), [itinerary, focusedDay]);
  const dayRoutes = useMemo(() => {
    if (focusedDay === undefined) return routes;
    const ids = new Set(markers.map((marker) => marker.place.id));
    return routes.filter((route) => ids.has(route.from) && ids.has(route.to));
  }, [routes, markers, focusedDay]);
  const selected = selectedActivity ? itinerary.stop(selectedActivity)?.place?.id : undefined;
  const canShowMap = destinations.length > 0 || itinerary.markersFor().length > 0;

  if (!destination || !canShowMap) {
    const locating = !!destination && (!destinationsSettled || loading);
    return (
      <section className="trip-map-canvas trip-map-canvas--empty" aria-label={t("Trip map")}>
        <div className="map-placeholder" role="status">
          <span className="map-placeholder__icon" aria-hidden="true">
            <MapPinIcon />
          </span>
          <h2>
            {!destination
              ? t("Your map will appear here")
              : locating
                ? t("Locating {v0}…", { v0: destination })
                : t("{destination} could not be shown on the map yet", { destination })}
          </h2>
          <p>
            {!destination
              ? t("Tell us a destination and dates in the chat, or add them in the bar at the top.")
              : locating
                ? t("Your itinerary stays available while places load.")
                : unavailable || destinationsUnavailable
                  ? t("Map places are temporarily unavailable. Your plan is unchanged.")
                  : t(
                      "Your plan is unchanged. Activities appear once they have a confirmed place.",
                    )}
          </p>
          {destination && !locating && (unavailable > 0 || destinationsUnavailable) && (
            <button type="button" onClick={retry}>
              {t("Retry places")}
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="trip-map-canvas" aria-label={t("Trip map")}>
      <TripMap
        mockData={tripPlaces.dataMode === "mock"}
        forceOsmProvider={tripPlaces.forceOsm}
        allowOsmFallback={tripPlaces.allowFallback}
        stops={markers}
        phone={phone}
        focusRequest={focusRequest}
        destinations={destinations}
        selected={selected}
        onSelect={(placeId) => {
          const activityId = markers.find((marker) => marker.place.id === placeId)?.activityId;
          if (activityId) onSelectActivity(activityId);
        }}
        routes={dayRoutes}
        viewKey={focusedDay === undefined ? viewKey : `${viewKey}:day:${focusedDay}`}
        showPhotos={showPhotos}
        userLocation={userLocation}
      />
      {(loading || unconfirmed > 0 || unavailable > 0) && (
        // Lightweight and non-blocking: located places stay usable on the map.
        <div className="trip-map-status trip-map-status--partial" role="status">
          <p>
            {loading
              ? t("Finding places…")
              : [
                  unconfirmed > 0 &&
                    `${unconfirmed} ${unconfirmed === 1 ? "activity has" : "activities have"} no confirmed place yet`,
                  unavailable > 0 && `${unavailable} could not be loaded from the map service`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
          {!loading && unavailable > 0 && (
            <button type="button" onClick={retry}>
              {t("Retry places")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
