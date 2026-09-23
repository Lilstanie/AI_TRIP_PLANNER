"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { RouteResult } from "@/lib/integrations/google";
import type { TripPlaces } from "./useTripPlaces";
import { MapPinIcon } from "../ui/icons";

const TripMap = dynamic(() => import("./TripMap").then((m) => m.TripMap), {
  ssr: false,
  loading: () => <p className="trip-map-loading">Loading map…</p>,
});

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
}: {
  /** The trip destination, or undefined for a blank conversation. */
  destination?: string;
  viewKey?: string;
  tripPlaces: TripPlaces;
  selectedActivity?: string;
  onSelectActivity(id: string): void;
  routes: RouteResult[];
  /** Load Google place photos; only in live data mode, because every image is billed. */
  showPhotos?: boolean;
}) {
  const {
    markers,
    destinations,
    destinationsSettled,
    destinationsUnavailable,
    loading,
    unconfirmed,
    unavailable,
    retry,
    activityForPlace,
  } = tripPlaces;
  const places = useMemo(() => markers.map((marker) => marker.place), [markers]);
  const selected = markers.find((marker) => marker.activityId === selectedActivity)?.place.id;
  const canShowMap = destinations.length > 0 || markers.length > 0;

  if (!destination || !canShowMap) {
    const locating = !!destination && (!destinationsSettled || loading);
    return (
      <section className="trip-map-canvas trip-map-canvas--empty" aria-label="Trip map">
        <div className="map-placeholder" role="status">
          <span className="map-placeholder__icon" aria-hidden="true">
            <MapPinIcon />
          </span>
          <h2>
            {!destination
              ? "Your map will appear here"
              : locating
                ? `Locating ${destination}…`
                : `${destination} could not be shown on the map yet`}
          </h2>
          <p>
            {!destination
              ? "Tell us a destination and dates in the chat, or add them in the bar at the top."
              : locating
                ? "Your itinerary stays available while places load."
                : unavailable || destinationsUnavailable
                  ? "Google Places is temporarily unavailable. Your plan is unchanged."
                  : "Your plan is unchanged. Activities appear once they have a confirmed place."}
          </p>
          {destination && !locating && (unavailable > 0 || destinationsUnavailable) && (
            <button type="button" onClick={retry}>
              Retry places
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="trip-map-canvas" aria-label="Trip map">
      <TripMap
        places={places}
        destinations={destinations}
        selected={selected}
        onSelect={(placeId) => {
          const activityId = activityForPlace(placeId);
          if (activityId) onSelectActivity(activityId);
        }}
        routes={routes}
        viewKey={viewKey}
        showPhotos={showPhotos}
      />
      {(loading || unconfirmed > 0 || unavailable > 0) && (
        // Lightweight and non-blocking: located places stay usable on the map.
        <div className="trip-map-status trip-map-status--partial" role="status">
          <p>
            {loading
              ? "Finding places…"
              : [
                  unconfirmed > 0 &&
                    `${unconfirmed} ${unconfirmed === 1 ? "activity has" : "activities have"} no confirmed place yet`,
                  unavailable > 0 && `${unavailable} could not be loaded from Google Places`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
          {!loading && unavailable > 0 && (
            <button type="button" onClick={retry}>
              Retry places
            </button>
          )}
        </div>
      )}
    </section>
  );
}
