"use client";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import { errorNotice, type Notice } from "@/lib/i18n/notice";
import { dayCount } from "@/lib/trip/timeline";
import type { PlanRevisions } from "./plan-revision";

export type LegState = {
  /** A day's legs are being routed now. */
  working: boolean;
  /**
   * Why the last routing of a day was refused or failed. Shown only while that day's stops are the same
   * as when it was asked: a change to them makes the problem stale, and the day is asked again.
   */
  problems: Notice[];
  /**
   * Records that a day is current with an applied edit that routed it on the server: a leg change routes
   * its own leg only, and a time, move or undo edit routes every leg of its day, so the day's legs are
   * not asked for again.
   */
  noteLeg(plan: TripPlan, day: number): void;
};

/** The scheduled stops of a day, in plan order: the order the server routes them in. */
function stopsOn(plan: TripPlan, day: number) {
  const items = plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? [];
  return items.filter((item) => item.kind === "activity" && item.id && item.day === day);
}

/**
 * What a day's legs are routed from: its stops, their places and times. Stored legs are left out on
 * purpose: a leg's own change, or an unroutable leg losing its travel time, must not ask for the whole
 * day again. Only a change to the day's stops or times does.
 */
function signature(plan: TripPlan, day: number) {
  return stopsOn(plan, day)
    .map((stop) =>
      [stop.id, stop.placeId ?? "", stop.startTime ?? "", stop.endTime ?? ""].join("|"),
    )
    .join(";");
}

/** What the day-by-day check remembers between plans. */
type Memory = {
  /** The signature each day's legs were checked for: by a verify that succeeded, or an applied edit that routed it. */
  routed: Map<number, string>;
  /** The signature a day's verify was refused or failed for: not asked again until its stops change. */
  refused: Map<number, string>;
};

/**
 * The first day that needs its legs checked: every stop on it has its place saved, and its stops or times
 * differ from the last state it was checked (or refused) in. A day is never recorded as checked without a
 * check: a day whose stops already carry travel times is checked once its places are saved.
 */
function dayNeedingLegs(plan: TripPlan, memory: Memory) {
  for (let day = 1; day <= dayCount(plan); day += 1) {
    const stops = stopsOn(plan, day);
    if (stops.length < 2) continue;
    if (stops.some((stop) => !stop.placeId)) continue;
    const now = signature(plan, day);
    if (memory.routed.get(day) === now || memory.refused.get(day) === now) continue;
    return day;
  }
  return undefined;
}

/**
 * Checks a day's legs once its places are all saved, and again only when that day's stops change. The
 * check is one `verify` per day, so an auto-save of five places checks the day once, not five times, and a
 * render never checks anything. Runs whether or not the Trip timeline is open, as the place saves do. The
 * rules for when the check applies are the plan revision owner's (`plan-revision.ts`). See the Agent Note
 * on leg travel times.
 *
 * - A day is recorded as checked only when its verify succeeds, or when an applied edit has already routed
 *   it (the server answered that edit with the day's routes).
 * - A check the owner discards (an edit or a newer plan came first) is asked again for the current plan.
 * - A refusal or failure is shown as a problem, and the day is not asked again until its stops change.
 * - `onRoutes` receives the routes the answer verified, which the workspace keeps for the legs and the map.
 */
export function useLegRoutes({
  plan,
  revisions,
  onRoutes,
}: {
  plan: TripPlan | undefined;
  revisions: PlanRevisions;
  onRoutes(routes: RouteResult[]): void;
}): LegState {
  const [state, setState] = useState<
    Pick<LegState, "working" | "problems"> & { problemDay?: number; problemSig?: string }
  >({ working: false, problems: [] });
  const memory = useRef<Memory>({ routed: new Map(), refused: new Map() });
  const routesRef = useRef(onRoutes);
  routesRef.current = onRoutes;
  const { tick, offer } = revisions;

  useEffect(() => {
    if (!plan) return;
    const day = dayNeedingLegs(plan, memory.current);
    if (day === undefined) return;
    const sig = signature(plan, day);
    const started = offer({
      key: `legs|${day}`,
      plan,
      operation: { kind: "verify", day },
      settled(outcome) {
        if (outcome.kind === "discarded") {
          setState((old) => ({ ...old, working: false }));
          return;
        }
        if (outcome.kind === "failed") {
          memory.current.refused.set(day, sig);
          setState({
            working: false,
            problems: [errorNotice(outcome.error, { key: "Route check failed. Try again." })],
            problemDay: day,
            problemSig: sig,
          });
          return;
        }
        const { answer } = outcome;
        if (!answer.plan) {
          memory.current.refused.set(day, sig);
          setState({ working: false, problems: answer.blockers, problemDay: day, problemSig: sig });
          return;
        }
        routesRef.current(answer.routes);
        memory.current.routed.set(day, signature(answer.plan, day));
        setState({ working: false, problems: [] });
      },
    });
    if (started) setState((old) => ({ ...old, working: true }));
  }, [plan, tick, offer]);

  function noteLeg(next: TripPlan, day: number) {
    memory.current.routed.set(day, signature(next, day));
  }

  // A problem belongs to the stops it was found for; once those change it is no longer shown.
  const stale =
    state.problemDay === undefined ||
    !plan ||
    signature(plan, state.problemDay) !== state.problemSig;
  return { working: state.working, problems: stale ? [] : state.problems, noteLeg };
}
