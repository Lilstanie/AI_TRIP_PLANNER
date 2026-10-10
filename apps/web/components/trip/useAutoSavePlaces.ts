"use client";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { TripPlaces } from "../map/useTripPlaces";
import type { PlanRevisions } from "./plan-revision";

export type AutoSaveState = {
  saving: string;

  failed: ReadonlySet<string>;
};

export const IDLE_AUTO_SAVE: AutoSaveState = { saving: "", failed: new Set() };

type Stop = TripPlaces["activities"][number];

export function useAutoSavePlaces({
  plan,
  tripPlaces,
  revisions,
}: {
  plan: TripPlan | undefined;
  tripPlaces: TripPlaces;
  revisions: PlanRevisions;
}): AutoSaveState {
  const { activities, placeIdFor, locationStatus } = tripPlaces;
  const { tick, offer } = revisions;
  const [state, setState] = useState<AutoSaveState>(IDLE_AUTO_SAVE);
  const tried = useRef(new Set<string>());
  const seen = useRef<TripPlan | undefined>(undefined);

  const own = useRef<TripPlan | undefined>(undefined);

  useEffect(() => {
    if (seen.current !== plan) {
      seen.current = plan;
      if (plan !== own.current) {
        tried.current = new Set();
        setState((old) => (old.failed.size ? { ...old, failed: new Set() } : old));
      }
    }
    if (!plan) return;
    const next = nextStop(activities, placeIdFor, locationStatus, tried.current);
    if (!next) return;
    const { stop, placeId, key } = next;
    tried.current.add(key);
    const started = offer({
      key: `save|${key}`,
      plan,

      operation: { kind: "place", id: stop.id!, placeId, routeLater: true },
      settled(outcome) {
        setState((old) => ({ ...old, saving: "" }));
        if (outcome.kind === "discarded") {
          tried.current.delete(key);
          return;
        }
        if (outcome.kind === "answer" && outcome.answer.plan) {
          own.current = outcome.answer.plan;
          return;
        }

        setState((old) => ({ ...old, failed: new Set(old.failed).add(stop.id!) }));
      },
    });
    if (started) setState((old) => ({ ...old, saving: stop.id! }));
    else tried.current.delete(key);
  }, [plan, activities, placeIdFor, locationStatus, tick, offer]);

  return state;
}

function nextStop(
  activities: Stop[],
  placeIdFor: TripPlaces["placeIdFor"],
  locationStatus: TripPlaces["locationStatus"],
  tried: ReadonlySet<string>,
) {
  for (const stop of activities) {
    if (!stop.id || !stop.day || !stop.startTime || stop.placeId) continue;
    if (locationStatus(stop) !== "located") continue;
    const placeId = placeIdFor(stop);
    if (!placeId) continue;
    const key = `${stop.id}|${placeId}`;
    if (!tried.has(key)) return { stop, placeId, key };
  }
  return undefined;
}
