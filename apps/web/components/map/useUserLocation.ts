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

export type UserLocation = {
  location: LocationState;

  request(): void;
};

function wasAllowed(): boolean {
  try {
    return localStorage.getItem(LOCATION_CHOICE_KEY) === "allowed";
  } catch {
    return false;
  }
}

function rememberAllowed() {
  try {
    localStorage.setItem(LOCATION_CHOICE_KEY, "allowed");
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
      key: "locationPermissionWasDeniedYou",
    };
  if (error.code === 2) return { key: "yourCurrentLocationIsUnavailable" };
  if (error.code === 3) return { key: "findingYourLocationTimedOut" };
  return { key: "yourCurrentLocationCouldNot" };
}

export function useUserLocation(): UserLocation {
  const [location, setLocation] = useState<LocationState>({ status: "idle" });

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocation({
        status: "error",
        message: { key: "locationIsNotSupportedBy" },
      });
      return;
    }
    setLocation({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        rememberAllowed();
        setLocation({
          status: "success",
          position: { lat: coords.latitude, lng: coords.longitude },
          message: { key: "yourCurrentLocationIsShown" },
        });
      },
      (cause) => setLocation({ status: "error", message: geolocationError(cause) }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (!wasAllowed()) return;
    let cancelled = false;
    void permissionState().then((state) => {
      if (!cancelled && state === "granted") request();
    });
    return () => {
      cancelled = true;
    };
  }, [request]);

  return { location, request };
}
