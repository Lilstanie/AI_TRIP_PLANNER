"use client";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import { errorNotice, type Notice } from "@/lib/i18n/notice";
import { dayCount } from "@/lib/trip/timeline";
import type { PlanRevisions } from "./plan-revision";

export type LegState = {
  working: boolean;

  problems: Notice[];

  noteLeg(plan: TripPlan, day: number): void;
};

function stopsOn(plan: TripPlan, day: number) {
  const items = plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? [];
  return items.filter((item) => item.kind === "activity" && item.id && item.day === day);
}

function signature(plan: TripPlan, day: number) {
  return stopsOn(plan, day)
    .map((stop) =>
      [stop.id, stop.placeId ?? "", stop.startTime ?? "", stop.endTime ?? ""].join("|"),
    )
    .join(";");
}

type Memory = {
  routed: Map<number, string>;

  refused: Map<number, string>;
};

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

  const stale =
    state.problemDay === undefined ||
    !plan ||
    signature(plan, state.problemDay) !== state.problemSig;
  return { working: state.working, problems: stale ? [] : state.problems, noteLeg };
}
