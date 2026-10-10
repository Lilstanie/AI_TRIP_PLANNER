"use client";
import type { TripPlan } from "@trip/shared";
import { NoticeError, type Notice } from "@/lib/i18n/notice";
export const STALE_PLAN: Notice = { key: "This edit is stale. Start from the current plan." };

const keyFor = (tripId: string) => `trip.revision:${tripId}`;
const fingerprint = (plan: TripPlan) => JSON.stringify(plan);

export function isCurrentTabPlan(plan: TripPlan): boolean {
  try {
    const current = localStorage.getItem(keyFor(plan.tripId));
    return current === null || current === fingerprint(plan);
  } catch {
    return true;
  }
}
export function publishTabPlan(plan: TripPlan) {
  try {
    localStorage.setItem(keyFor(plan.tripId), fingerprint(plan));
  } catch {}
}
export function seedTabPlan(plan: TripPlan) {
  try {
    if (localStorage.getItem(keyFor(plan.tripId)) === null) publishTabPlan(plan);
  } catch {}
}
export async function withTabPlan<T>(
  plan: TripPlan,
  signal: AbortSignal,
  run: () => Promise<T>,
): Promise<T> {
  const checked = async () => {
    signal.throwIfAborted();
    if (!isCurrentTabPlan(plan)) throw new NoticeError(STALE_PLAN);
    return run();
  };
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(`trip-edit:${plan.tripId}`, { signal }, checked);
  return checked();
}
