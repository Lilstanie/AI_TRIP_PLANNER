"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "../account/LocaleProvider";
import type { RouteResult } from "@/lib/integrations/google";
import type { TripPlaces } from "./useTripPlaces";
import type { UserLocation } from "./useUserLocation";
import { MapPinIcon } from "../ui/icons";
import { useSettings } from "../account/SettingsProvider";
import { useHomeBase } from "./useHomeBase";

const TripMap = dynamic(() => import("./TripMap").then((m) => m.TripMap), {
  ssr: false,
  loading: MapLoading,
});

function MapLoading() {
  const { t } = useLocale();
  return <p className="trip-map-loading">{t("Loading map…")}</p>;
}

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
  visible = true,
  focusedDay,
  focusRequest,
  onOpenChat,
}: {
  onOpenChat?(): void;
  phone?: boolean;
  visible?: boolean;
  focusedDay?: number;
  focusRequest?: number;
  destination?: string;
  viewKey?: string;
  tripPlaces: TripPlaces;
  selectedActivity?: string;
  onSelectActivity(id: string): void;
  routes: RouteResult[];

  showPhotos?: boolean;

  userLocation: UserLocation;
}) {
  const { t, locale } = useLocale();
  const homeCity = useSettings().settings.travel.homeCity;
  const home = useHomeBase(destination ? "" : homeCity, tripPlaces.dataMode, locale);
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

  const markers = useMemo(() => itinerary.markersFor(focusedDay), [itinerary, focusedDay]);
  const dayRoutes = useMemo(() => {
    if (focusedDay === undefined) return routes;
    const ids = new Set(markers.map((marker) => marker.place.id));
    return routes.filter((route) => ids.has(route.from) && ids.has(route.to));
  }, [routes, markers, focusedDay]);
  const selected = selectedActivity ? itinerary.stop(selectedActivity)?.place?.id : undefined;
  const canShowMap = destinations.length > 0 || itinerary.markersFor().length > 0;

  if (!destination) {
    return (
      <section
        className="trip-map-canvas"
        aria-label={t("Trip map")}
        data-basemap-centre={home ? "home" : "world"}
      >
        <TripMap
          quiet
          center={home}
          mockData={tripPlaces.dataMode === "mock"}
          forceOsmProvider={tripPlaces.forceOsm}
          allowOsmFallback={tripPlaces.allowFallback}
          stops={[]}
          phone={phone}
          visible={visible}
          onSelect={onSelectActivity}
          routes={[]}
          viewKey={viewKey}
          userLocation={userLocation}
        />
        <div className="trip-map-hint glass-float" role="status">
          <p>{t("Where are you going?")}</p>
          {onOpenChat && (
            <button type="button" className="primary" onClick={onOpenChat}>
              {t("Plan in Chat")}
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!canShowMap) {
    const locating = !destinationsSettled || loading;
    return (
      <section className="trip-map-canvas trip-map-canvas--empty" aria-label={t("Trip map")}>
        <div className="map-placeholder" role="status">
          <span className="map-placeholder__icon" aria-hidden="true">
            <MapPinIcon />
          </span>
          <h2>
            {locating
              ? t("Locating {v0}…", { v0: destination })
              : t("{destination} could not be shown on the map yet", { destination })}
          </h2>
          <p>
            {locating
              ? t("Your itinerary stays available while places load.")
              : unavailable || destinationsUnavailable
                ? t("Map places are temporarily unavailable. Your plan is unchanged.")
                : t("Your plan is unchanged. Activities appear once they have a confirmed place.")}
          </p>
          {!locating && (unavailable > 0 || destinationsUnavailable) && (
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
        visible={visible}
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
        <div className="trip-map-status trip-map-status--partial" role="status">
          <p>
            {loading
              ? t("Finding places…")
              : [
                  unconfirmed > 0 &&
                    (unconfirmed === 1
                      ? t("{count} activity has no confirmed place yet", { count: unconfirmed })
                      : t("{count} activities have no confirmed place yet", {
                          count: unconfirmed,
                        })),
                  unavailable > 0 &&
                    t("{count} could not be loaded from the map service", { count: unavailable }),
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
