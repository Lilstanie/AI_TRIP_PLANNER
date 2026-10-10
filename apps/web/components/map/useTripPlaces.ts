"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { GooglePlace } from "@/lib/integrations/google";
import { dataModeHeaders, type DataMode } from "@/lib/workspace/data-mode";
import { itineraryActivities } from "@/lib/workspace";
import { destinationCities, placeQueryFor } from "@/lib/map/place-query";
import { buildItinerary, type Itinerary } from "@/lib/trip/itinerary";

type Activity = ReturnType<typeof itineraryActivities>[number];

export type LocationStatus = "located" | "loading" | "unconfirmed" | "unavailable";

export type TripPlaces = {
  dataMode?: DataMode;
  forceOsm?: boolean;
  allowFallback?: boolean;

  activities: Activity[];

  itinerary: Itinerary;
  places: Record<string, GooglePlace>;

  destinations: GooglePlace[];

  destinationsSettled: boolean;

  destinationsUnavailable: boolean;
  loading: boolean;

  unconfirmed: number;

  unavailable: number;
  locationStatus(activity: Activity): LocationStatus;
  placeIdFor(activity: Activity): string | undefined;
  rememberPlace(place: GooglePlace): void;

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

export function useTripPlaces(
  plan: TripPlan | undefined,
  dataMode?: DataMode,
  language?: "en" | "zh",
  forceOsm?: boolean,
  allowFallback = true,
): TripPlaces {
  const activities = useMemo(() => itineraryActivities(plan), [plan]);
  const destination = plan?.brief.destination ?? "";
  const cities = useMemo(() => destinationCities(destination), [destination]);
  const [places, setPlaces] = useState<Record<string, GooglePlace>>({});
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [attempt, setAttempt] = useState(0);
  const loadedContexts = useRef(new Map<string, string>());
  const detailContext = `${dataMode ?? "default"}:${language ?? "en"}`;
  const known = useRef({ places, outcomes });
  known.current = { places, outcomes };

  const contextKey = useCallback(
    (kind: string, text: string, city = "") =>
      keyFor(`${kind}:${dataMode ?? "default"}:${language ?? "en"}`, text, city),
    [dataMode, language],
  );
  const lookupKey = useCallback(
    (activity: Activity) => {
      const query = placeQueryFor(activity);
      if (query.kind === "id") return contextKey("id", query.placeId);
      if (query.kind === "search") return contextKey("search", query.text, destination);
      return undefined;
    },
    [destination, contextKey],
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
          headers: { "Content-Type": "application/json", ...dataModeHeaders(dataMode) },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (cause) {
        if (controller.signal.aborted) throw cause;
        throw new LookupError(true);
      }
      const json = await response.json().catch(() => ({}));
      if (response.status === 429 || response.status >= 500) throw new LookupError(true);
      if (!response.ok) throw new LookupError(false);
      return json;
    };
    const needs = (key: string) => {
      const outcome = done[key];
      return (
        !outcome ||
        outcome.status === "unavailable" ||
        (outcome.status === "found" &&
          loadedContexts.current.get(outcome.placeId) !== detailContext)
      );
    };
    for (const city of cities) {
      const key = contextKey("city", city);
      if (needs(key))
        wanted.set(key, async () => {
          const body = await post("/api/places/search", { text: city, language });
          const place = (body.places as GooglePlace[] | undefined)?.find((item) => item.location);
          if (!place) throw new LookupError(false);
          return place;
        });
    }
    for (const activity of activities) {
      const query = placeQueryFor(activity);
      const key = lookupKey(activity);
      if (!key || !needs(key) || wanted.has(key)) continue;
      if (
        query.kind === "id" &&
        loaded[query.placeId] &&
        loadedContexts.current.get(query.placeId) === detailContext
      )
        continue;
      if (query.kind === "id")
        wanted.set(key, async () => {
          try {
            const body = await post("/api/places/details", { placeId: query.placeId, language });
            return body.place as GooglePlace;
          } catch (error) {
            if (!activity.savedPlace) throw error;
            return {
              id: query.placeId,
              displayName: { text: activity.savedPlace.name },
              formattedAddress: activity.savedPlace.address,
              location: activity.savedPlace.location,
              source: query.placeId.startsWith("osm:") ? "osm" : "google",
            };
          }
        });
      else if (query.kind === "search")
        wanted.set(key, async () => {
          const body = await post("/api/places/search", {
            text: query.text,
            language,
            ...(destination ? { destination } : {}),
          });
          const place = (body.places as GooglePlace[] | undefined)?.find((item) => item.location);
          if (!place) throw new LookupError(false);
          if (place.id.startsWith("osm:")) {
            try {
              return (await post("/api/places/details", { placeId: place.id, language }))
                .place as GooglePlace;
            } catch {
              return place;
            }
          }
          return place;
        });
    }
    if (!wanted.size) {
      setPending(new Set());
      return;
    }
    setPending(new Set(wanted.keys()));

    for (const [key, run] of wanted) {
      void run()
        .then(
          (place): Outcome => {
            if (!controller.signal.aborted) {
              loadedContexts.current.set(place.id, detailContext);
              setPlaces((old) => ({ ...old, [place.id]: place }));
            }
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
  }, [
    activities,
    cities,
    destination,
    attempt,
    lookupKey,
    dataMode,
    language,
    contextKey,
    detailContext,
  ]);

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

  const itinerary = useMemo(
    () =>
      buildItinerary(plan, (activity) => {
        const placeId = placeIdFor(activity);
        return placeId ? places[placeId] : undefined;
      }),
    [plan, places, placeIdFor],
  );

  const destinations = useMemo(
    () =>
      cities.flatMap((city) => {
        const outcome = outcomes[contextKey("city", city)];
        const place = outcome?.status === "found" ? places[outcome.placeId] : undefined;
        return place?.location ? [place] : [];
      }),
    [cities, outcomes, places, contextKey],
  );
  const destinationsSettled = cities.every((city) => {
    const key = contextKey("city", city);
    return !pending.has(key) && !!outcomes[key];
  });

  const destinationsUnavailable = cities.some(
    (city) => outcomes[contextKey("city", city)]?.status === "unavailable",
  );
  const statuses = activities.map(locationStatus);
  const rememberPlace = useCallback(
    (place: GooglePlace) => {
      loadedContexts.current.set(place.id, detailContext);
      setPlaces((old) => ({ ...old, [place.id]: place }));
    },
    [detailContext],
  );
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    dataMode,
    forceOsm,
    allowFallback,
    activities,
    itinerary,
    places,
    destinations,
    destinationsSettled,
    destinationsUnavailable,
    loading: pending.size > 0,
    unconfirmed: statuses.filter((status) => status === "unconfirmed").length,
    unavailable: statuses.filter((status) => status === "unavailable").length,
    locationStatus,
    placeIdFor,
    rememberPlace,
    retry,
  };
}
