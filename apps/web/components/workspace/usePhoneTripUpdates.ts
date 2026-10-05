"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceController } from "./useWorkspaceController";
import { usePhoneBack } from "./usePhoneBack";

// Catalog validation rebuilds objects in schema order. Sort object keys so a restored snapshot
// and the same live plan have one revision, regardless of property insertion order.
const fingerprint = (value: unknown) =>
  JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );

/** Track what the traveller read for each trip, so switching between saved trips cannot turn
 * an unchanged plan into an update. Manual edits count even without a new planner round. */
export function usePhoneTripUpdates(model: WorkspaceController) {
  const { plan, phone, mobileView } = model;
  const revision = useMemo(() => (plan ? fingerprint(plan) : undefined), [plan]);
  const read = useRef<Map<string, string> | undefined>(undefined);
  if (!read.current) {
    // Existing history is the baseline, not a new planner result. A newly produced trip is absent
    // from this map until its Trip tab is opened; the map survives chat/trip switching.
    read.current = new Map(
      model.catalog.trips.map((trip) => [
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
  usePhoneBack(phone);
  return { tripUpdated: tripUpdated && mobileView !== "trip" };
}
