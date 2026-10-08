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
  /** Why the last routing of a day was refused or failed; cleared by the next routing. */
  problems: Notice[];
  /**
   * Records that a day is current with an applied leg change: that change routed its own leg only,
   * so the day's other legs are not asked for again.
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

/**
 * The first day that needs its legs routed: every stop on it has its place saved, and its stops or
 * times differ from the last state it was routed (or found already routed) in. A day whose stops
 * changed by an applied edit is routed again, even when its legs still have stored times. A day
 * never seen before whose legs are all stored is recorded as current without a request, so a page
 * load does not route every day again.
 */
function dayNeedingLegs(plan: TripPlan, asked: Map<number, string>) {
  for (let day = 1; day <= dayCount(plan); day += 1) {
    const stops = stopsOn(plan, day);
    if (stops.length < 2 || stops.some((stop) => !stop.placeId)) continue;
    const now = signature(plan, day);
    const was = asked.get(day);
    if (was === now) continue;
    if (was === undefined && stops.slice(1).every((stop) => stop.arriveBy)) {
      asked.set(day, now);
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
 * - One day is routed at a time; a newer plan (chat, a timeline edit) cancels the one in flight and
 *   the day is asked again for the plan that is current.
 * - A refusal or failure is shown as a problem and the day is not asked again until its stops change.
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
  const [state, setState] = useState<Omit<LegState, "noteLeg">>({ working: false, problems: [] });
  // Bumped when a day's request was cancelled, so the day is looked at again.
  const [again, setAgain] = useState(0);
  const asked = useRef(new Map<number, string>());
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

  useEffect(() => {
    if (!enabled || !plan || flight.current) return;
    const day = dayNeedingLegs(plan, asked.current);
    if (day === undefined) return;
    asked.current.set(day, signature(plan, day));
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
          // Replaced by a newer plan: the day is looked at again for that plan.
          asked.current.delete(day);
          setAgain((value) => value + 1);
          setState((old) => ({ ...old, working: false }));
          return;
        }
        if (!answer.plan) {
          setState({ working: false, problems: answer.blockers });
          return;
        }
        routesRef.current(answer.routes);
        asked.current.set(day, signature(answer.plan, day));
        setState({ working: false, problems: [] });
        applyRef.current(answer.plan);
      },
      (error: unknown) => {
        if (flight.current === controller) flight.current = null;
        if (controller.signal.aborted) {
          asked.current.delete(day);
          setAgain((value) => value + 1);
          setState((old) => ({ ...old, working: false }));
          return;
        }
        setState({
          working: false,
          problems: [errorNotice(error, { key: "Route check failed. Try again." })],
        });
      },
    );
  }, [plan, enabled, dataMode, currency, again]);

  function noteLeg(next: TripPlan, day: number) {
    asked.current.set(day, signature(next, day));
  }

  return { ...state, noteLeg };
}
