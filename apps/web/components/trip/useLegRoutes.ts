"use client";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { useSettings } from "@/components/account/SettingsProvider";
import type { RouteResult } from "@/lib/integrations/google";
import { errorNotice, type Notice } from "@/lib/i18n/notice";
import type { DataMode } from "@/lib/workspace/data-mode";
import { dayCount } from "@/lib/trip/timeline";
import { requestPreview } from "./previewRequest";

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
  /** The signature each day's legs were last routed for, by a verify that succeeded or an applied edit. */
  routed: Map<number, string>;
  /** The signature a day's verify was refused or failed for: not asked again until its stops change. */
  refused: Map<number, string>;
  /** Days seen with a stop that has no saved place. Their stored legs are the planner's, not checked. */
  unsaved: Set<number>;
};

/**
 * The first day that needs its legs routed: every stop on it has its place saved, and its stops or
 * times differ from the last state it was routed (or refused) in. A day whose places were all saved
 * when it was first seen, with every leg already stored, is recorded as routed without a request, so a
 * page load does not route every day again. A day that was seen with an unsaved place is never recorded
 * that way: its stored legs are only the planner's estimates, so it is verified once its places are saved.
 */
function dayNeedingLegs(plan: TripPlan, memory: Memory) {
  for (let day = 1; day <= dayCount(plan); day += 1) {
    const stops = stopsOn(plan, day);
    if (stops.length < 2) continue;
    if (stops.some((stop) => !stop.placeId)) {
      memory.unsaved.add(day);
      continue;
    }
    const now = signature(plan, day);
    if (memory.routed.get(day) === now || memory.refused.get(day) === now) continue;
    if (
      memory.routed.get(day) === undefined &&
      !memory.unsaved.has(day) &&
      stops.slice(1).every((stop) => stop.arriveBy)
    ) {
      memory.routed.set(day, now);
      continue;
    }
    return day;
  }
  return undefined;
}

/**
 * Routes a day's legs once its places are all saved, and again only when that day's stops change.
 * The routing is one `verify` per day, so an auto-save of five places routes the day once, not five
 * times, and a render never routes anything. Runs whether or not the Trip timeline is open, as the
 * place saves do. See the Agent Note on leg travel times.
 *
 * - One day is routed at a time. A newer plan (chat, a timeline edit) cancels the one in flight, and so
 *   does a user edit starting (`enabled` turns false); the day is then asked again for the plan that is
 *   current, so a background result never replaces a plan an edit is working on.
 * - A day is recorded as routed only when its verify succeeds, or when an applied edit already routed it.
 * - A refusal or failure is shown as a problem, and the day is not asked again until its stops change.
 * - `onRoutes` receives the routes the answer verified, which the workspace keeps for the legs and the map.
 */
export function useLegRoutes({
  plan,
  enabled,
  dataMode,
  onApply,
  onRoutes,
}: {
  plan: TripPlan | undefined;
  /** False while chat or a timeline edit is running; routing waits for it. */
  enabled: boolean;
  dataMode: DataMode | undefined;
  onApply(plan: TripPlan): void;
  onRoutes(routes: RouteResult[]): void;
}): LegState {
  const { settings } = useSettings();
  const [state, setState] = useState<
    Pick<LegState, "working" | "problems"> & { problemDay?: number; problemSig?: string }
  >({ working: false, problems: [] });
  // Bumped when a day's request was cancelled, so the day is looked at again.
  const [again, setAgain] = useState(0);
  const memory = useRef<Memory>({ routed: new Map(), refused: new Map(), unsaved: new Set() });
  const flight = useRef<AbortController | null>(null);
  const latest = useRef(plan);
  latest.current = plan;
  const applyRef = useRef(onApply);
  applyRef.current = onApply;
  const routesRef = useRef(onRoutes);
  routesRef.current = onRoutes;
  const currency = settings.displayCurrency;

  // A newer plan cancels a routing still in flight, as a newer plan cancels an auto-save.
  useEffect(
    () => () => {
      flight.current?.abort();
      flight.current = null;
    },
    [plan],
  );
  useEffect(
    () => () => {
      flight.current?.abort();
      flight.current = null;
    },
    [],
  );
  // A user edit (or chat) starting cancels the routing in flight. Its result would replace the plan the
  // edit is checking; the day is asked again once routing is enabled.
  useEffect(() => {
    if (enabled) return;
    flight.current?.abort();
    flight.current = null;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !plan || flight.current) return;
    const day = dayNeedingLegs(plan, memory.current);
    if (day === undefined) return;
    const sig = signature(plan, day);
    const controller = new AbortController();
    flight.current = controller;
    setState((old) => ({ ...old, working: true }));
    void requestPreview({
      plan,
      operation: { kind: "verify", day },
      displayCurrency: currency,
      dataMode,
      signal: controller.signal,
    }).then(
      (answer) => {
        if (flight.current === controller) flight.current = null;
        if (controller.signal.aborted || latest.current !== plan) {
          // Cancelled or replaced by a newer plan: the day is asked again for the plan that is current.
          setAgain((value) => value + 1);
          setState((old) => ({ ...old, working: false }));
          return;
        }
        if (!answer.plan) {
          memory.current.refused.set(day, sig);
          setState({ working: false, problems: answer.blockers, problemDay: day, problemSig: sig });
          return;
        }
        routesRef.current(answer.routes);
        memory.current.routed.set(day, signature(answer.plan, day));
        setState({ working: false, problems: [] });
        applyRef.current(answer.plan);
      },
      (error: unknown) => {
        if (flight.current === controller) flight.current = null;
        if (controller.signal.aborted) {
          setAgain((value) => value + 1);
          setState((old) => ({ ...old, working: false }));
          return;
        }
        memory.current.refused.set(day, sig);
        setState({
          working: false,
          problems: [errorNotice(error, { key: "Route check failed. Try again." })],
          problemDay: day,
          problemSig: sig,
        });
      },
    );
  }, [plan, enabled, dataMode, currency, again]);

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
