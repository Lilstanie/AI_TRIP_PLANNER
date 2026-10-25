"use client";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { GooglePlace } from "@/lib/integrations/google";
import { dayCount } from "@/lib/trip/timeline";
import { itineraryActivities } from "@/lib/trip/itinerary";
import { onTripDay } from "@/lib/trip/on-trip-day";
import { rememberBrowsing, savedBrowsing, type TripBrowsing } from "@/lib/workspace/browsing";

export function useTripDay(
  plan: TripPlan | undefined,
  destination: GooglePlace | undefined,
  selected: string | undefined,
  controlled?: { day: number; onChange(day: number): void },
  settled = true,
) {
  const tripId = plan?.tripId;
  const days = plan ? dayCount(plan) : 1;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const today = plan ? onTripDay(plan.brief.dates, destination, now) : undefined;
  const cache = useRef(new Map<string, TripBrowsing>());
  const [state, setState] = useState(() => ({ tripId, ...savedBrowsing(plan) }));
  const current =
    state.tripId === tripId ? state : (tripId && cache.current.get(tripId)) || savedBrowsing(plan);
  const day = controlled?.day ?? Math.min(Math.max(1, current.day), days);
  const external = controlled !== undefined;
  useEffect(() => {
    if (external) return;
    setState((previous) => {
      const base =
        previous.tripId === tripId
          ? previous
          : (tripId && cache.current.get(tripId)) || savedBrowsing(plan);
      const next = {
        ...base,
        tripId,
        day:
          settled && today !== undefined && (!base.manual || base.selectedOnToday !== today)
            ? today
            : settled && today === undefined && base.selectedOnToday !== null
              ? 1
              : Math.min(Math.max(1, base.day), days),
        selectedOnToday: settled ? (today ?? null) : base.selectedOnToday,
      };
      return previous.tripId === next.tripId &&
        previous.day === next.day &&
        previous.selectedOnToday === next.selectedOnToday
        ? previous
        : next;
    });
  }, [tripId, days, today, plan, external, settled]);
  useEffect(() => {
    if (external || !tripId || state.tripId !== tripId) return;
    cache.current.set(tripId, { ...state, day });
    rememberBrowsing(tripId, { day, selectedOnToday: state.selectedOnToday, manual: state.manual });
  }, [tripId, state, day, external, settled]);
  const selectDay = (next: number) => {
    if (controlled) controlled.onChange(next);
    else
      setState({
        tripId,
        day: Math.min(Math.max(1, next), days),
        selectedOnToday: today ?? null,
        manual: true,
      });
  };
  const activeDay = itineraryActivities(plan).find((stop) => stop.id === selected)?.day;
  useEffect(() => {
    if (!external && activeDay !== undefined && activeDay !== day) {
      setState({
        tripId,
        day: Math.min(Math.max(1, activeDay), days),
        selectedOnToday: today ?? null,
        manual: true,
      });
    }
  }, [selected, activeDay, tripId, days, today, day, external]);
  return { day, today, selectDay };
}
