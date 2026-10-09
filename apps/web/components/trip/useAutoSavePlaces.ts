"use client";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { TripPlaces } from "../map/useTripPlaces";
import type { PlanRevisions } from "./plan-revision";

export type AutoSaveState = {
  /** The stop whose place is being saved now, or "". */
  saving: string;
  /** Stops whose place the map found but the server did not accept, for the current plan. */
  failed: ReadonlySet<string>;
};

export const IDLE_AUTO_SAVE: AutoSaveState = { saving: "", failed: new Set() };

type Stop = TripPlaces["activities"][number];

/**
 * Saves the place the map found by name for each scheduled stop that has none saved, through the
 * immediate place edit (`POST /api/trip/preview-edit`, `place` operation). The rules for when a save
 * applies, and for an edit that lands first, are the plan revision owner's (`plan-revision.ts`). See the
 * Agent Note on auto-saved stop places for the failure modes this is written against.
 *
 * - One save is in flight at a time for the trip; the next stop is tried once the previous one settles.
 * - Each stop and place is sent once per plan. A plan that did not come from one of these saves
 *   (a chat replan, a restore, the traveller's own edit) starts a new set of attempts.
 * - A save the server refuses or fails is not retried automatically; the stop is marked failed.
 * - A save discarded by an edit or a newer plan is not marked failed; the stop is sent again for the
 *   current plan.
 */
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
  // The last plan this hook saved a place into: its own apply does not start a new set of attempts.
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
      // Sent with `routeLater`: the day is checked once after its last save, not on each save.
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
        // Refused or failed: the stop stays unsaved for this plan and the next stop is tried.
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
    // Only scheduled stops, and only ones without a saved place.
    if (!stop.id || !stop.day || !stop.startTime || stop.placeId) continue;
    if (locationStatus(stop) !== "located") continue;
    const placeId = placeIdFor(stop);
    if (!placeId) continue;
    const key = `${stop.id}|${placeId}`;
    if (!tried.has(key)) return { stop, placeId, key };
  }
  return undefined;
}
