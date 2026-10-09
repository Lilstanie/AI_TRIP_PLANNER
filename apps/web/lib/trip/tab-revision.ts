"use client";
import type { TripPlan } from "@trip/shared";
import { NoticeError } from "@/lib/i18n/notice";
const keyFor = (tripId: string) => `trip.revision:${tripId}`;
const fingerprint = (plan: TripPlan) => JSON.stringify(plan);

/** Browser-local optimistic concurrency; successful applies publish before releasing the Web Lock. */
export function isCurrentTabPlan(plan: TripPlan): boolean {
  try {
    const current = localStorage.getItem(keyFor(plan.tripId));
    return current === null || current === fingerprint(plan);
  } catch {
    return true;
  } // The workspace already reports blocked storage separately.
}
export function publishTabPlan(plan: TripPlan) {
  try {
    localStorage.setItem(keyFor(plan.tripId), fingerprint(plan));
  } catch {
    /* No storage available. */
  }
}
export function seedTabPlan(plan: TripPlan) {
  try {
    if (localStorage.getItem(keyFor(plan.tripId)) === null) publishTabPlan(plan);
  } catch {
    /* No storage. */
  }
}
export async function withTabPlan<T>(
  plan: TripPlan,
  signal: AbortSignal,
  run: () => Promise<T>,
): Promise<T> {
  const checked = async () => {
    signal.throwIfAborted();
    if (!isCurrentTabPlan(plan))
      throw new NoticeError({ key: "This edit is stale. Start from the current plan." });
    return run();
  };
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(`trip-edit:${plan.tripId}`, { signal }, checked);
  return checked();
}
