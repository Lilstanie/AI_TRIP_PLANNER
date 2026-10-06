"use client";
import { useEffect, useRef, useState } from "react";
import { TripPlan } from "@trip/shared";
import type { GooglePlace, RouteResult } from "@/lib/integrations/google";
import type { EditInput, EditPreview } from "@/lib/trip/trip-edit";
import { NoticeError, type Notice } from "@/lib/i18n/notice";
import type { TripPlaces } from "../../map/useTripPlaces";

export type RouteMode = "WALK" | "TRANSIT";
type Operation = EditInput["operation"];

/**
 * Everything the timeline asks the server: edit previews, place search, and the routes last
 * verified. An edit never touches the plan directly — it is previewed by `/api/trip/preview-edit`
 * (routes, budget and conflicts recomputed) and only `apply` hands the previewed plan to the
 * workspace. The previous activities are kept so the last applied edit can be undone the same way.
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
  const [mode, setMode] = useState<RouteMode>("WALK");
  const [results, setResults] = useState<GooglePlace[]>([]);
  // A preview refusal is a Notice; place search errors are still English text until they are keyed.
  const [error, setError] = useState<Notice | string>("");
  const [working, setWorking] = useState<"" | "preview" | "search">("");
  const [preview, setPreview] = useState<EditPreview>();
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
  const returnFocus = useRef<HTMLElement | null>(null);
  const request = useRef<AbortController | null>(null);
  const current = useRef(plan);
  current.current = plan;

  // A new plan (from chat, a restore, or our own apply) ends any preview in flight. Only a plan
  // that did not come from `apply` forgets the undo step and the routes verified for the old one.
  useEffect(() => {
    request.current?.abort();
    setPreview(undefined);
    if (applied.current !== plan) {
      setUndo(undefined);
      setVerifiedRoutes([]);
    }
    applied.current = null;
    setWorking("");
  }, [plan]);
  useEffect(() => {
    onPending(!!preview || working !== "");
  }, [preview, working, onPending]);
  // Closing a preview returns focus to the control that opened it, once that control is enabled
  // again on the next render.
  const hadPreview = useRef(false);
  useEffect(() => {
    if (preview) hadPreview.current = true;
    else if (hadPreview.current) {
      hadPreview.current = false;
      returnFocus.current?.focus();
    }
  }, [preview]);
  const routesSynced = useRef(false);
  useEffect(() => {
    // Skip the mount: reopening the timeline must not erase routes already on the map.
    if (!routesSynced.current) {
      routesSynced.current = true;
      return;
    }
    onRoutesChange?.(preview?.routes ?? verifiedRoutes);
  }, [preview, verifiedRoutes, onRoutesChange]);
  useEffect(
    () => () => {
      request.current?.abort();
      onPending(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function run<T>(kind: "preview" | "search", call: (signal: AbortSignal) => Promise<T>) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setWorking(kind);
    setError("");
    try {
      return await call(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof NoticeError
            ? e.notice
            : e instanceof Error
              ? e.message
              : { key: "Something went wrong. Try again." },
        );
      return undefined;
    } finally {
      if (request.current === controller) setWorking("");
    }
  }

  async function edit(operation: Operation) {
    returnFocus.current = document.activeElement as HTMLElement;
    const base = plan;
    setPreview(undefined);
    await run("preview", async (signal) => {
      const response = await fetch("/api/trip/preview-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, baseVersion: plan.editVersion ?? 0, operation, mode }),
        signal,
      });
      const body = await response.json();
      if (!response.ok)
        throw new NoticeError(
          body.notice ??
            (body.error ? { raw: body.error } : { key: "Preview failed. Try the change again." }),
        );
      // A plan that changed while the preview was in flight makes the preview stale.
      if (!signal.aborted && current.current === base)
        setPreview({ ...body, plan: TripPlan.parse(body.plan) });
    });
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
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Search failed. Try again.");
      if (!signal.aborted) {
        setResults(body.places);
        if (!body.places.length) setError({ key: "No places found. Try different words." });
      }
    });
  }

  function apply() {
    if (!preview) return;
    if (preview.baseVersion !== (plan.editVersion ?? 0)) {
      setError({ key: "The trip changed while this was being checked. Make the change again." });
      setPreview(undefined);
      return;
    }
    applied.current = preview.plan;
    setUndo({
      kind: "undo",
      activities: activities.map((a) => ({
        id: a.id!,
        day: a.day!,
        startTime: a.startTime!,
        endTime: a.endTime!,
        placeId: a.placeId,
        priceNeedsReview: a.priceNeedsReview,
      })),
    });
    setVerifiedRoutes(preview.routes);
    const after = new Map(
      (preview.plan.sections.find((s) => s.id === "itinerary")?.proposal?.items ?? []).map(
        (item) => [item.id, item],
      ),
    );
    setChanged(
      new Set(
        activities.flatMap((before) => {
          const now = before.id ? after.get(before.id) : undefined;
          return now &&
            (now.day !== before.day ||
              now.startTime !== before.startTime ||
              now.endTime !== before.endTime ||
              now.placeId !== before.placeId)
            ? [before.id!]
            : [];
        }),
      ),
    );
    onApply(preview.plan);
    setPreview(undefined);
  }

  function cancel() {
    setPreview(undefined);
  }

  return {
    mode,
    setMode,
    results,
    clearResults: () => setResults([]),
    error,
    working,
    preview,
    undo,
    routes: preview?.routes ?? verifiedRoutes,
    changed,
    busy: working !== "" || !!preview,
    edit,
    search,
    apply,
    cancel,
  };
}

export type TimelineEdits = ReturnType<typeof useTimelineEdits>;
