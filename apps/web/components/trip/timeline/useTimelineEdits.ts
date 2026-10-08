"use client";
import { useEffect, useRef, useState } from "react";
import { TripPlan } from "@trip/shared";
import { useSettings } from "@/components/account/SettingsProvider";
import type { GooglePlace, RouteResult } from "@/lib/integrations/google";
import type { EditInput } from "@/lib/trip/trip-edit";
import { errorNotice, failureNotice, NoticeError, type Notice } from "@/lib/i18n/notice";
import type { TripPlaces } from "../../map/useTripPlaces";

export type RouteMode = "WALK" | "TRANSIT";
type Operation = EditInput["operation"];

/**
 * Everything the timeline asks the server: edits, place search, and the routes last verified.
 * An edit is sent to `/api/trip/preview-edit`, which recomputes routes, budget and conflicts. When
 * the server accepts it, the plan it returns is applied at once; a refused edit leaves the plan
 * unchanged and its blockers are shown as notices. "Undo last change" replays the previous
 * activities through the same path. See the Agent Note on immediate timeline edits.
 */
export function useTimelineEdits({
  plan,
  activities,
  onApply,
  onPending,
  onRoutesChange,
}: {
  plan: TripPlan;
  activities: TripPlaces["activities"];
  onApply(plan: TripPlan): void;
  onPending(value: boolean): void;
  onRoutesChange?(routes: RouteResult[]): void;
}) {
  const { settings } = useSettings();
  const [mode, setMode] = useState<RouteMode>("WALK");
  const [results, setResults] = useState<GooglePlace[]>([]);
  const [errors, setErrors] = useState<Notice[]>([]);
  const [working, setWorking] = useState<"" | "edit" | "search">("");
  const [undo, setUndo] = useState<Operation>();
  const [verifiedRoutes, setVerifiedRoutes] = useState<RouteResult[]>([]);
  // Stops an applied edit moved, retimed or re-placed, flashed once so the eye finds them.
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!changed.size) return;
    const timer = window.setTimeout(() => setChanged(new Set()), 1600);
    return () => window.clearTimeout(timer);
  }, [changed]);
  const applied = useRef<TripPlan | null>(null);
  const request = useRef<AbortController | null>(null);
  const current = useRef(plan);
  current.current = plan;

  // A new plan (from chat, a restore, or our own apply) ends any edit in flight. Only a plan that
  // did not come from an edit forgets the undo step and the routes verified for the old one.
  useEffect(() => {
    request.current?.abort();
    if (applied.current !== plan) {
      setUndo(undefined);
      setVerifiedRoutes([]);
    }
    applied.current = null;
    setWorking("");
  }, [plan]);
  useEffect(() => {
    onPending(working !== "");
  }, [working, onPending]);
  const routesSynced = useRef(false);
  useEffect(() => {
    // Skip the mount: reopening the timeline must not erase routes already on the map.
    if (!routesSynced.current) {
      routesSynced.current = true;
      return;
    }
    onRoutesChange?.(verifiedRoutes);
  }, [verifiedRoutes, onRoutesChange]);
  useEffect(
    () => () => {
      request.current?.abort();
      onPending(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function run<T>(kind: "edit" | "search", call: (signal: AbortSignal) => Promise<T>) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setWorking(kind);
    setErrors([]);
    try {
      return await call(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted)
        setErrors([errorNotice(e, { key: "Something went wrong. Try again." })]);
      return undefined;
    } finally {
      if (request.current === controller) setWorking("");
    }
  }

  async function edit(operation: Operation) {
    const base = plan;
    await run("edit", async (signal) => {
      const response = await fetch("/api/trip/preview-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          baseVersion: plan.editVersion ?? 0,
          operation,
          mode,
          displayCurrency: settings.displayCurrency,
        }),
        signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new NoticeError(
          failureNotice(body, { key: "Preview failed. Try the change again." }),
        );
      // A plan that changed while the request was in flight makes the result stale.
      if (signal.aborted || current.current !== base) return;
      const blockers: Notice[] = body.blockerNotices ?? [];
      if (blockers.length) {
        // Refused: the plan stays as it is and the blockers say why.
        setErrors(blockers);
        return;
      }
      commit(TripPlan.parse(body.plan), body.routes ?? []);
    });
  }

  // Applies a plan the server accepted, and records the step that undoes it.
  function commit(next: TripPlan, routes: RouteResult[]) {
    const before = activities.map((a) => ({
      id: a.id!,
      day: a.day!,
      startTime: a.startTime!,
      endTime: a.endTime!,
      placeId: a.placeId,
      priceNeedsReview: a.priceNeedsReview,
    }));
    const after = new Map(
      (next.sections.find((s) => s.id === "itinerary")?.proposal?.items ?? []).map((item) => [
        item.id,
        item,
      ]),
    );
    applied.current = next;
    setUndo({ kind: "undo", activities: before });
    setVerifiedRoutes(routes);
    setChanged(
      new Set(
        activities.flatMap((stop) => {
          const now = stop.id ? after.get(stop.id) : undefined;
          return now &&
            (now.day !== stop.day ||
              now.startTime !== stop.startTime ||
              now.endTime !== stop.endTime ||
              now.placeId !== stop.placeId)
            ? [stop.id!]
            : [];
        }),
      ),
    );
    onApply(next);
  }

  async function search(text: string) {
    setResults([]);
    await run("search", async (signal) => {
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, destination: plan.brief.destination }),
        signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new NoticeError(failureNotice(body, { key: "Search failed. Try again." }));
      if (!signal.aborted) {
        setResults(body.places);
        if (!body.places.length) setErrors([{ key: "No places found. Try different words." }]);
      }
    });
  }

  return {
    mode,
    setMode,
    results,
    clearResults: () => setResults([]),
    errors,
    working,
    undo,
    routes: verifiedRoutes,
    changed,
    busy: working !== "",
    edit,
    search,
  };
}

export type TimelineEdits = ReturnType<typeof useTimelineEdits>;
