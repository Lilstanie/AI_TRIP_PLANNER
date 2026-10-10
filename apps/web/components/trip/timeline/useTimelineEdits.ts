"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { dataModeHeaders, type DataMode } from "@/lib/workspace/data-mode";
import { useEffect, useRef, useState } from "react";
import { TripPlan } from "@trip/shared";
import type { GooglePlace, RouteResult } from "@/lib/integrations/google";
import type { EditInput } from "@/lib/trip/trip-edit";
import type { LegMode } from "@/lib/trip/leg-routes";
import { undoStepOf } from "@/lib/trip/undo-step";
import { errorNotice, failureNotice, NoticeError, type Notice } from "@/lib/i18n/notice";
import type { TripPlaces } from "../../map/useTripPlaces";
import { PLAN_CHANGED, type PlanRevisions } from "../plan-revision";

type Operation = EditInput["operation"];

function touchedDays(operation: Operation, activities: TripPlaces["activities"]): number[] {
  const dayOf = (id: string) => activities.find((stop) => stop.id === id)?.day;
  const days = new Set<number>();
  if (operation.kind === "time" || operation.kind === "leg") add(dayOf(operation.id));
  else if (operation.kind === "place") {
    if (!operation.routeLater) add(dayOf(operation.id));
  } else if (operation.kind === "move") {
    add(dayOf(operation.id));
    days.add(operation.day);
  } else if (operation.kind === "schedule") {
    add(dayOf(operation.id));
    days.add(operation.day);
  } else if (operation.kind === "remove" || operation.kind === "idea" || operation.kind === "swap")
    add(dayOf(operation.id));
  else if (operation.kind === "undo") for (const stop of operation.activities) days.add(stop.day);
  function add(day: number | undefined) {
    if (day !== undefined) days.add(day);
  }
  return [...days];
}

export function useTimelineEdits({
  plan,
  dataMode,
  activities,
  revisions,
  onPending,
  onRoutesChange,
  onLegApplied,
  onTimelineChange,
}: {
  plan: TripPlan;
  dataMode?: DataMode;
  activities: TripPlaces["activities"];
  revisions: PlanRevisions;
  onPending(value: boolean): void;

  onRoutesChange?(routes: RouteResult[]): void;

  onLegApplied?(plan: TripPlan, day: number): void;

  onTimelineChange?(changed: boolean): void;
}) {
  const { locale } = useLocale();
  const [results, setResults] = useState<GooglePlace[]>([]);
  const [errors, setErrors] = useState<Notice[]>([]);
  const [working, setWorking] = useState<"" | "edit" | "search">("");
  const [undo, setUndo] = useState<Operation>();

  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!changed.size) return;
    const timer = window.setTimeout(() => setChanged(new Set()), 1600);
    return () => window.clearTimeout(timer);
  }, [changed]);
  const applied = useRef<TripPlan | null>(null);
  const request = useRef<AbortController | null>(null);
  const requestKind = useRef<"" | "edit" | "search">("");

  useEffect(() => {
    if (requestKind.current === "search") {
      request.current?.abort();
      setWorking("");
    }
    if (applied.current !== plan) setUndo(undefined);
    applied.current = null;
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
    requestKind.current = kind;
    setWorking(kind);
    setErrors([]);
    try {
      return await call(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted)
        setErrors([errorNotice(e, { key: "Something went wrong. Try again." })]);
      return undefined;
    } finally {
      if (request.current === controller) {
        setWorking("");
        requestKind.current = "";
      }
    }
  }

  async function edit(
    operation: Operation,
    onApplied?: (previous: TripPlan, next: TripPlan) => void,
  ): Promise<boolean> {
    const checked = plan;
    const done = await run("edit", async (signal) => {
      const result = await revisions.edit(operation, {
        signal,
        beforeApply: (answer) => {
          for (const day of touchedDays(operation, activities)) onLegApplied?.(answer.plan, day);
          recordUndo(operation, checked, answer.plan, answer.routes);
        },
      });

      if (result.kind === "stale") setErrors([PLAN_CHANGED]);
      else if (result.kind === "refused") setErrors(result.blockers);
      else if (result.kind === "applied") onApplied?.(checked, result.answer.plan);
      return result.kind === "applied";
    });
    return done === true;
  }

  function recordUndo(
    operation: Operation,
    checked: TripPlan,
    next: TripPlan,
    routes: RouteResult[],
  ) {
    const after = new Map(
      (next.sections.find((s) => s.id === "itinerary")?.proposal?.items ?? []).map((item) => [
        item.id,
        item,
      ]),
    );
    applied.current = next;
    onTimelineChange?.(operation.kind !== "undo");
    setUndo(
      operation.kind === "remove" ||
        operation.kind === "idea" ||
        operation.kind === "schedule" ||
        operation.kind === "swap"
        ? undefined
        : undoStepOf(checked),
    );
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
  }

  function leg(id: string, mode: LegMode) {
    return edit({ kind: "leg", id, mode });
  }

  async function search(text: string) {
    setResults([]);
    await run("search", async (signal) => {
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...dataModeHeaders(dataMode) },
        body: JSON.stringify({ text, destination: plan.brief.destination, language: locale }),
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
