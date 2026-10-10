"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceModel } from "./useWorkspace";

const fingerprint = (value: unknown) =>
  JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );

export function usePhoneTripUpdates(model: WorkspaceModel) {
  const { plan } = model.session;
  const { phone, mobileView } = model.layout;
  const revision = useMemo(() => (plan ? fingerprint(plan) : undefined), [plan]);
  const read = useRef<Map<string, string> | undefined>(undefined);
  if (!read.current) {
    read.current = new Map(
      model.history.catalog.trips.map((trip) => [
        trip.snapshot.plan.tripId,
        fingerprint(trip.snapshot.plan),
      ]),
    );
    if (plan && revision) read.current.set(plan.tripId, revision);
  }
  const [tripUpdated, setTripUpdated] = useState(false);
  useEffect(() => {
    if (!phone || !plan || !revision) {
      setTripUpdated(false);
      return;
    }
    if (mobileView === "trip") read.current!.set(plan.tripId, revision);
    setTripUpdated(read.current!.get(plan.tripId) !== revision);
  }, [plan, revision, phone, mobileView]);
  return { tripUpdated: tripUpdated && mobileView !== "trip" };
}
