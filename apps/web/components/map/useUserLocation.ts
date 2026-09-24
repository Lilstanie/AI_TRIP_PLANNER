"use client";
import { useCallback, useEffect, useState } from "react";

export type Coordinate = { lat: number; lng: number };
export type LocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; position: Coordinate; message: string }
  | { status: "error"; message: string };

/** The traveller's answer to the in-app location question, remembered in this browser only. */
export const LOCATION_CHOICE_KEY = "trip.locationPrompt";
type Choice = "allowed" | "dismissed";

export type UserLocation = {
  location: LocationState;
  /** Show the in-app question: nothing answered yet and the browser has not blocked location. */
  asking: boolean;
  /** Ask the browser for the position. Only ever called from a user action or an earlier Allow. */
  request(): void;
  /** The traveller chose Allow location in the in-app question. */
  allow(): void;
  /** The traveller chose Not now; the question does not return in this browser. */
  dismiss(): void;
};

function readChoice(): Choice | undefined {
  try {
    const value = localStorage.getItem(LOCATION_CHOICE_KEY);
    return value === "allowed" || value === "dismissed" ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeChoice(choice: Choice) {
  try {
    localStorage.setItem(LOCATION_CHOICE_KEY, choice);
  } catch {
    // Storage blocked: the answer holds for this page only, which is still no nagging.
  }
}

async function permissionState(): Promise<PermissionState | undefined> {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" });
    return status?.state;
  } catch {
    return undefined;
  }
}

export function geolocationError(error: GeolocationPositionError) {
  if (error.code === 1)
    return "Location permission was denied. You can retry after allowing it in your browser settings.";
  if (error.code === 2)
    return "Your current location is unavailable. Check your device settings and retry.";
  if (error.code === 3) return "Finding your location timed out. Please retry.";
  return "Your current location could not be found. Please retry.";
}

/**
 * The traveller's current position, asked for on open in our own words first.
 *
 * The browser's permission prompt appears only after the traveller presses Allow location (or Show
 * my location on the map). Only the answer to our question is stored; the position itself stays in
 * memory, is never saved or written into a plan, and leaves the browser only when the traveller
 * asks for a route from it.
 */
export function useUserLocation(): UserLocation {
  const [location, setLocation] = useState<LocationState>({ status: "idle" });
  const [asking, setAsking] = useState(false);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocation({ status: "error", message: "Location is not supported by this browser." });
      return;
    }
    setLocation({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        setLocation({
          status: "success",
          position: { lat: coords.latitude, lng: coords.longitude },
          message: "Your current location is shown on the map.",
        }),
      (cause) => setLocation({ status: "error", message: geolocationError(cause) }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const choice = readChoice();
    if (choice === "dismissed") return;
    void permissionState().then((state) => {
      if (cancelled || state === "denied") return;
      // An earlier Allow the browser still honours: show the position without asking again.
      if (choice === "allowed" && state === "granted") request();
      else setAsking(true);
    });
    return () => {
      cancelled = true;
    };
  }, [request]);

  // Once the browser has answered, whichever way, the in-app question is done.
  useEffect(() => {
    if (location.status !== "idle") setAsking(false);
  }, [location.status]);

  const allow = useCallback(() => {
    writeChoice("allowed");
    setAsking(false);
    request();
  }, [request]);

  const dismiss = useCallback(() => {
    writeChoice("dismissed");
    setAsking(false);
  }, []);

  return { location, asking, request, allow, dismiss };
}
