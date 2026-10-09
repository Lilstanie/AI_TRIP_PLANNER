"use client";
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

/**
 * The days a server edit routes: the day of the stop it names, both days of a move, and the saved days of an
 * undo. A place saved with `routeLater` is routed afterwards by a verify, so it touches no day here. A remove,
 * an Idea or an arrow move routes the stop's day; a schedule routes the day it left and the day it goes to.
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

/**
 * Everything the timeline asks the server: edits, the travel mode of one leg, and place search. An edit
 * is sent through the plan revision owner, which applies an accepted plan at once; the routes it verified
 * are handed to the workspace, and the day's undo step is recorded. A refused edit leaves the plan
 * unchanged and its blockers are shown as notices. "Undo last change" replays the previous activities,
 * legs included, through the same path. See the Agent Notes on immediate timeline edits, on leg travel
 * times and on one owner for plan revisions.
 */
export function useTimelineEdits({
  plan,
  activities,
  revisions,
  onPending,
  onRoutesChange,
  onLegApplied,
  onTimelineChange,
}: {
  plan: TripPlan;
  activities: TripPlaces["activities"];
  revisions: PlanRevisions;
  onPending(value: boolean): void;
  /** Routes an applied edit verified; the workspace keeps them for the legs and the map. */
  onRoutesChange?(routes: RouteResult[]): void;
  /** An applied leg change: its day is current, so the day's other legs are not routed again. */
  onLegApplied?(plan: TripPlan, day: number): void;
  /** An applied edit is a change on the timeline (true); "Undo last change" puts it back (false). */
  onTimelineChange?(changed: boolean): void;
}) {
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
  const requestKind = useRef<"" | "edit" | "search">("");

  // A new plan (from chat, a restore, or our own apply) ends a place search in flight. An edit in flight is not
  // abandoned: the plan revision owner judges it against the plan it was sent for, and a plan that has moved on
  // answers with the try-again notice. Only a plan that did not come from an edit forgets the undo step.
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

  /**
   * Sends an edit for the plan on screen. `onApplied` runs once the server accepts it, with the plan it was
   * checked against and the plan it produced; a remove, an Idea, a schedule or an arrow move uses it to offer
   * the item undo. Resolves to whether the edit was applied.
   */
  async function edit(
    operation: Operation,
    onApplied?: (previous: TripPlan, next: TripPlan) => void,
  ): Promise<boolean> {
    // The plan the edit is checked against: the one on screen when the traveller acted.
    const checked = plan;
    const done = await run("edit", async (signal) => {
      const result = await revisions.edit(operation, {
        signal,
        beforeApply: (answer) => {
          // The server routed every day this edit touched, so those days are recorded as checked. Otherwise the
          // workspace checks them again, and that second plan replaces this one and drops its Undo step.
          for (const day of touchedDays(operation, activities)) onLegApplied?.(answer.plan, day);
          recordUndo(operation, checked, answer.plan, answer.routes);
        },
      });
      // A plan that changed from elsewhere (chat or a restore) while the check ran makes the answer stale: nothing
      // is applied, and the traveller is told to try again instead of seeing nothing happen.
      if (result.kind === "stale") setErrors([PLAN_CHANGED]);
      // Refused: the plan stays as it is and the blockers say why.
      else if (result.kind === "refused") setErrors(result.blockers);
      else if (result.kind === "applied") onApplied?.(checked, result.answer.plan);
      return result.kind === "applied";
    });
    return done === true;
  }

  // Records the step that undoes an applied plan. The plan itself is applied by the owner, after this. A
  // remove, an Idea, a schedule or an arrow move records no step here: its undo is the item undo, which puts
  // the whole plan back, so a stop it took away needs no restoring.
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
