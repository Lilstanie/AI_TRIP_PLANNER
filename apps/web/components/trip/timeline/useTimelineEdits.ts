"use client";
import { useEffect, useRef, useState } from "react";
import { TripPlan } from "@trip/shared";
import { useSettings } from "@/components/account/SettingsProvider";
import type { GooglePlace, RouteResult } from "@/lib/integrations/google";
import type { EditInput } from "@/lib/trip/trip-edit";
import type { LegMode } from "@/lib/trip/leg-routes";
import { errorNotice, failureNotice, NoticeError, type Notice } from "@/lib/i18n/notice";
import type { DataMode } from "@/lib/workspace/data-mode";
import type { TripPlaces } from "../../map/useTripPlaces";
import { requestPreview } from "../previewRequest";

type Operation = EditInput["operation"];

/**
 * The days a server edit routes: the day of the stop it names, both days of a move, and the saved days of an
 * undo. A place saved with `routeLater` is routed afterwards by a verify, so it touches no day here.
 */
function touchedDays(operation: Operation, activities: TripPlaces["activities"]): number[] {
  const dayOf = (id: string) => activities.find((stop) => stop.id === id)?.day;
  const days = new Set<number>();
  if (operation.kind === "time" || operation.kind === "leg") add(dayOf(operation.id));
  else if (operation.kind === "place") {
    if (!operation.routeLater) add(dayOf(operation.id));
  } else if (operation.kind === "move") {
    add(dayOf(operation.id));
    days.add(operation.day);
  } else if (operation.kind === "undo") for (const stop of operation.activities) days.add(stop.day);
  function add(day: number | undefined) {
    if (day !== undefined) days.add(day);
  }
  return [...days];
}

/**
 * Everything the timeline asks the server: edits, the travel mode of one leg, and place search. An edit
 * is sent to `/api/trip/preview-edit`, which recomputes routes, budget and conflicts. When the server
 * accepts it, the plan it returns is applied at once and the routes it verified are handed to the
 * workspace; a refused edit leaves the plan unchanged and its blockers are shown as notices. "Undo last
 * change" replays the previous activities, legs included, through the same path. See the Agent Notes
 * on immediate timeline edits and on leg travel times.
 */
export function useTimelineEdits({
  plan,
  activities,
  dataMode,
  onApply,
  onPending,
  onRoutesChange,
  onLegApplied,
}: {
  plan: TripPlan;
  activities: TripPlaces["activities"];
  dataMode: DataMode | undefined;
  onApply(plan: TripPlan): void;
  onPending(value: boolean): void;
  /** Routes an applied edit verified; the workspace keeps them for the legs and the map. */
  onRoutesChange?(routes: RouteResult[]): void;
  /** An applied leg change: its day is current, so the day's other legs are not routed again. */
  onLegApplied?(plan: TripPlan, day: number): void;
}) {
  const { settings } = useSettings();
  const [results, setResults] = useState<GooglePlace[]>([]);
  const [errors, setErrors] = useState<Notice[]>([]);
  const [working, setWorking] = useState<"" | "edit" | "search">("");
  const [undo, setUndo] = useState<Operation>();
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
  // did not come from an edit forgets the undo step.
  useEffect(() => {
    request.current?.abort();
    if (applied.current !== plan) setUndo(undefined);
    applied.current = null;
    setWorking("");
  }, [plan]);
  useEffect(() => {
    onPending(working !== "");
  }, [working, onPending]);
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
      const answer = await requestPreview({
        plan,
        operation,
        displayCurrency: settings.displayCurrency,
        dataMode,
        signal,
      });
      // A plan that changed while the request was in flight makes the result stale.
      if (signal.aborted || current.current !== base) return;
      // Refused: the plan stays as it is and the blockers say why.
      if (answer.blockers.length) {
        setErrors(answer.blockers);
        return;
      }
      // The server routed every day this edit touched, so those days are recorded as checked. Otherwise the
      // workspace checks them again, and that second plan replaces this one and drops its Undo step.
      for (const day of touchedDays(operation, activities)) onLegApplied?.(answer.plan!, day);
      commit(answer.plan!, answer.routes);
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
      ...(a.arriveBy ? { arriveBy: a.arriveBy } : {}),
    }));
    const after = new Map(
      (next.sections.find((s) => s.id === "itinerary")?.proposal?.items ?? []).map((item) => [
        item.id,
        item,
      ]),
    );
    applied.current = next;
    setUndo({ kind: "undo", activities: before });
    onRoutesChange?.(routes);
    setChanged(
      new Set(
        activities.flatMap((stop) => {
          const now = stop.id ? after.get(stop.id) : undefined;
          return now &&
            (now.day !== stop.day ||
              now.startTime !== stop.startTime ||
              now.endTime !== stop.endTime ||
              now.placeId !== stop.placeId ||
              now.arriveBy?.mode !== stop.arriveBy?.mode)
            ? [stop.id!]
            : [];
        }),
      ),
    );
    onApply(next);
  }

  /** Routes only the leg into `id` with the traveller's mode; the rest of the day is re-timed. */
  function leg(id: string, mode: LegMode) {
    return edit({ kind: "leg", id, mode });
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
    results,
    clearResults: () => setResults([]),
    errors,
    working,
    undo,
    changed,
    busy: working !== "",
    edit,
    leg,
    search,
  };
}

export type TimelineEdits = ReturnType<typeof useTimelineEdits>;
