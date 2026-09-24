"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { GooglePlace } from "@/lib/integrations/google";
import { itineraryActivities } from "@/lib/workspace";
import { destinationCities, placeQueryFor } from "@/lib/map/place-query";
import { itineraryOrder } from "@/lib/map/itinerary-route";

type Activity = ReturnType<typeof itineraryActivities>[number];

/**
 * One numbered map marker and the activity that owns it. Markers come in visiting order (day, then
 * start time); `order` is the 1-based stop number across the trip.
 */
export type TripMarker = {
  activityId: string;
  place: GooglePlace;
  verified: boolean;
  order: number;
  day?: number;
  startTime?: string;
};

/**
 * - `located`: the activity has a place on the map.
 * - `loading`: a lookup is in flight.
 * - `unconfirmed`: there is no concrete place to look up, or Google found none.
 * - `unavailable`: Google failed (timeout, rate limit, outage); Retry places will try again.
 */
export type LocationStatus = "located" | "loading" | "unconfirmed" | "unavailable";

export type TripPlaces = {
  activities: Activity[];
  markers: TripMarker[];
  places: Record<string, GooglePlace>;
  /** Resolved destination city places, used to frame the map before activities load. */
  destinations: GooglePlace[];
  /** True once every destination city lookup has finished, successfully or not. */
  destinationsSettled: boolean;
  /** A destination city lookup failed for a retryable reason. */
  destinationsUnavailable: boolean;
  loading: boolean;
  /** Activities without a confirmed place (no usable name, or no Google match). */
  unconfirmed: number;
  /** Activities whose lookup failed for a retryable reason. */
  unavailable: number;
  locationStatus(activity: Activity): LocationStatus;
  placeIdFor(activity: Activity): string | undefined;
  activityForPlace(placeId: string): string | undefined;
  rememberPlace(place: GooglePlace): void;
  /** Retry only lookups that failed for a retryable reason. */
  retry(): void;
};

type Outcome = { status: "found"; placeId: string } | { status: "notFound" | "unavailable" };

const keyFor = (kind: string, text: string, destination = "") =>
  `${kind} :: ${destination} :: ${text}`;

class LookupError extends Error {
  constructor(readonly retryable: boolean) {
    super(retryable ? "unavailable" : "notFound");
  }
}

/**
 * Resolve the active trip's destination and activities into Google places.
 *
 * Only saved place IDs, explicit location names and titles that are themselves place names
 * are looked up (see `placeQueryFor`); descriptive activity text never reaches Places. Results
 * live only in memory and are never written into the plan. Changing the plan aborts in-flight
 * lookups, so a response for a previous trip or chat cannot add markers to the current one.
 */
export function useTripPlaces(plan: TripPlan | undefined): TripPlaces {
  const activities = useMemo(() => itineraryActivities(plan), [plan]);
  const destination = plan?.brief.destination ?? "";
  const cities = useMemo(() => destinationCities(destination), [destination]);
  const [places, setPlaces] = useState<Record<string, GooglePlace>>({});
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [attempt, setAttempt] = useState(0);
  const known = useRef({ places, outcomes });
  known.current = { places, outcomes };

  const lookupKey = useCallback(
    (activity: Activity) => {
      const query = placeQueryFor(activity);
      if (query.kind === "id") return keyFor("id", query.placeId);
      if (query.kind === "search") return keyFor("search", query.text, destination);
      return undefined;
    },
    [destination],
  );

  useEffect(() => {
    const { outcomes: done, places: loaded } = known.current;
    const wanted = new Map<string, () => Promise<GooglePlace>>();
    const controller = new AbortController();
    const post = async (url: string, body: unknown) => {
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (cause) {
        if (controller.signal.aborted) throw cause;
        throw new LookupError(true); // network failure
      }
      const json = await response.json().catch(() => ({}));
      if (response.status === 429 || response.status >= 500) throw new LookupError(true);
      if (!response.ok) throw new LookupError(false);
      return json;
    };
    const needs = (key: string) => !done[key] || done[key]!.status === "unavailable";
    for (const city of cities) {
      const key = keyFor("city", city);
      if (needs(key))
        wanted.set(key, async () => {
          const body = await post("/api/places/search", { text: city });
          const place = (body.places as GooglePlace[] | undefined)?.find((item) => item.location);
          if (!place) throw new LookupError(false);
          return place;
        });
    }
    for (const activity of activities) {
      const query = placeQueryFor(activity);
      const key = lookupKey(activity);
      if (!key || !needs(key) || wanted.has(key)) continue;
      if (query.kind === "id" && loaded[query.placeId]) continue; // chosen in the editor
      if (query.kind === "id")
        wanted.set(key, async () => {
          const body = await post("/api/places/details", { placeId: query.placeId });
          return body.place as GooglePlace;
        });
      else if (query.kind === "search")
        wanted.set(key, async () => {
          const body = await post("/api/places/search", {
            text: query.text,
            ...(destination ? { destination } : {}),
          });
          const place = (body.places as GooglePlace[] | undefined)?.find((item) => item.location);
          if (!place) throw new LookupError(false);
          return place;
        });
    }
    if (!wanted.size) {
      setPending(new Set());
      return;
    }
    setPending(new Set(wanted.keys()));
    // Apply each result as it arrives, so one slow or failing lookup never holds back others.
    for (const [key, run] of wanted) {
      void run()
        .then(
          (place): Outcome => {
            if (!controller.signal.aborted) setPlaces((old) => ({ ...old, [place.id]: place }));
            return { status: "found", placeId: place.id };
          },
          (reason): Outcome => {
            const retryable = !(reason instanceof LookupError) || reason.retryable;
            return { status: retryable ? "unavailable" : "notFound" };
          },
        )
        .then((outcome) => {
          if (controller.signal.aborted) return;
          setOutcomes((old) => ({ ...old, [key]: outcome }));
          setPending((old) => {
            const next = new Set(old);
            next.delete(key);
            return next;
          });
        });
    }
    return () => controller.abort();
    // `attempt` re-runs lookups that previously failed for a retryable reason.
  }, [activities, cities, destination, attempt, lookupKey]);

  const placeIdFor = useCallback(
    (activity: Activity) => {
      if (activity.placeId && places[activity.placeId]) return activity.placeId;
      const key = lookupKey(activity);
      const outcome = key ? outcomes[key] : undefined;
      return outcome?.status === "found" ? outcome.placeId : undefined;
    },
    [lookupKey, outcomes, places],
  );

  const locationStatus = useCallback(
    (activity: Activity): LocationStatus => {
      if (activity.placeId && places[activity.placeId]?.location) return "located";
      const key = lookupKey(activity);
      if (!key) return "unconfirmed";
      if (pending.has(key)) return "loading";
      const outcome = outcomes[key];
      if (!outcome) return "loading";
      if (outcome.status === "found")
        return places[outcome.placeId]?.location ? "located" : "unconfirmed";
      return outcome.status === "unavailable" ? "unavailable" : "unconfirmed";
    },
    [lookupKey, outcomes, pending, places],
  );

  const markers = useMemo(() => {
    const seen = new Set<string>();
    const located = itineraryOrder(activities).flatMap((activity) => {
      const placeId = placeIdFor(activity);
      const place = placeId ? places[placeId] : undefined;
      if (!activity.id || !place?.location || seen.has(place.id)) return [];
      seen.add(place.id);
      return [{ activity, place }];
    });
    return located.map(({ activity, place }, index): TripMarker => ({
      activityId: activity.id!,
      place,
      verified: !!activity.placeId,
      order: index + 1,
      day: activity.day,
      startTime: activity.startTime,
    }));
  }, [activities, places, placeIdFor]);

  const destinations = useMemo(
    () =>
      cities.flatMap((city) => {
        const outcome = outcomes[keyFor("city", city)];
        const place = outcome?.status === "found" ? places[outcome.placeId] : undefined;
        return place?.location ? [place] : [];
      }),
    [cities, outcomes, places],
  );
  const destinationsSettled = cities.every((city) => {
    const key = keyFor("city", city);
    return !pending.has(key) && !!outcomes[key];
  });

  const destinationsUnavailable = cities.some(
    (city) => outcomes[keyFor("city", city)]?.status === "unavailable",
  );
  const statuses = activities.map(locationStatus);
  const activityForPlace = useCallback(
    (placeId: string) => markers.find((marker) => marker.place.id === placeId)?.activityId,
    [markers],
  );
  const rememberPlace = useCallback((place: GooglePlace) => {
    setPlaces((old) => ({ ...old, [place.id]: place }));
  }, []);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    activities,
    markers,
    places,
    destinations,
    destinationsSettled,
    destinationsUnavailable,
    loading: pending.size > 0,
    unconfirmed: statuses.filter((status) => status === "unconfirmed").length,
    unavailable: statuses.filter((status) => status === "unavailable").length,
    locationStatus,
    placeIdFor,
    activityForPlace,
    rememberPlace,
    retry,
  };
}
