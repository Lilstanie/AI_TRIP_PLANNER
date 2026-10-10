"use client";
import { useCallback, useEffect, useState } from "react";
import type { Notice } from "@/lib/i18n/notice";

export type Coordinate = { lat: number; lng: number };
export type LocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; position: Coordinate; message: Notice }
  | { status: "error"; message: Notice };

export const LOCATION_CHOICE_KEY = "trip.locationPrompt";
type Choice = "allowed" | "dismissed";

export type UserLocation = {
  location: LocationState;

  asking: boolean;

  request(): void;

  allow(): void;

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
  } catch {}
}

async function permissionState(): Promise<PermissionState | undefined> {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" });
    return status?.state;
  } catch {
    return undefined;
  }
}

export function geolocationError(error: GeolocationPositionError): Notice {
  if (error.code === 1)
    return {
      key: "Location permission was denied. You can retry after allowing it in your browser settings.",
    };
  if (error.code === 2)
    return { key: "Your current location is unavailable. Check your device settings and retry." };
  if (error.code === 3) return { key: "Finding your location timed out. Please retry." };
  return { key: "Your current location could not be found. Please retry." };
}

export function useUserLocation(): UserLocation {
  const [location, setLocation] = useState<LocationState>({ status: "idle" });
  const [asking, setAsking] = useState(false);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocation({
        status: "error",
        message: { key: "Location is not supported by this browser." },
      });
      return;
    }
    setLocation({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        setLocation({
          status: "success",
          position: { lat: coords.latitude, lng: coords.longitude },
          message: { key: "Your current location is shown on the map." },
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

      if (choice === "allowed" && state === "granted") request();
      else setAsking(true);
    });
    return () => {
      cancelled = true;
    };
  }, [request]);

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
