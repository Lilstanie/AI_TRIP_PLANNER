"use client";
import { useEffect, useRef, useState } from "react";
import { TripPlan } from "@trip/shared";
import { useSettings } from "@/components/account/SettingsProvider";
import type { DataMode } from "@/lib/workspace/data-mode";
import type { TripPlaces } from "../map/useTripPlaces";
import { requestPreview } from "./previewRequest";

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
 * immediate place edit (`POST /api/trip/preview-edit`, `place` operation). See the Agent Note on
 * auto-saved stop places for the failure modes this is written against.
 *
 * - One save is in flight at a time; the next stop is tried after the previous one settles.
 * - Each stop and place is sent once per plan. A plan that did not come from one of these saves
 *   (a chat replan, a restore, the traveller's own edit) starts a new set of attempts.
 * - A save the server refuses or fails is not retried automatically; the stop is marked failed.
 * - A save aborted by a newer request is not marked failed and may be sent again.
 */
export function useAutoSavePlaces({
  plan,
  tripPlaces,
  onApply,
  enabled,
  dataMode,
}: {
  plan: TripPlan | undefined;
  tripPlaces: TripPlaces;
  onApply(plan: TripPlan): void;
  /** False while chat or a timeline edit is running; saves wait for it. */
  enabled: boolean;
  dataMode: DataMode | undefined;
}): AutoSaveState {
  const { settings } = useSettings();
  const { activities, placeIdFor, locationStatus } = tripPlaces;
  const [state, setState] = useState<AutoSaveState>(IDLE_AUTO_SAVE);
  // Bumped after a save that did not commit, so the next stop is tried.
  const [advance, setAdvance] = useState(0);
  const flight = useRef<AbortController | null>(null);
  const tried = useRef(new Set<string>());
  const seen = useRef<TripPlan | undefined>(undefined);
  // The last plan this runner applied: its own apply does not start a new set of attempts.
  const own = useRef<TripPlan | undefined>(undefined);
  const latest = useRef(plan);
  latest.current = plan;
  const applyRef = useRef(onApply);
  applyRef.current = onApply;
  const currency = settings.displayCurrency;

  // A newer plan from chat, a restore or a timeline edit cancels a save still in flight.
  useEffect(
    () => () => {
      flight.current?.abort();
      flight.current = null;
    },
    [plan],
  );
  // A user edit (or chat) starting cancels a save in flight: its result would replace the plan the edit
  // is checking. The stop is tried again once saving is enabled.
  useEffect(() => {
    if (enabled) return;
    flight.current?.abort();
    flight.current = null;
  }, [enabled]);

  useEffect(() => {
    if (seen.current !== plan) {
      seen.current = plan;
      if (plan !== own.current) {
        tried.current = new Set();
        setState((old) => (old.failed.size ? { ...old, failed: new Set() } : old));
      }
    }
    if (!enabled || !plan || flight.current) return;
    const next = nextStop(activities, placeIdFor, locationStatus, tried.current);
    if (!next) return;
    const { stop, placeId, key } = next;
    const controller = new AbortController();
    flight.current = controller;
    tried.current.add(key);
    setState((old) => ({ ...old, saving: stop.id! }));
    void save(plan, stop.id!, placeId, currency, dataMode, controller.signal).then((accepted) => {
      if (flight.current === controller) flight.current = null;
      setState((old) => ({ ...old, saving: "" }));
      // Superseded by a newer request or plan, or sent for a plan that has since changed: forget the
      // attempt so a later run may send it again.
      if (controller.signal.aborted || (accepted && accepted.base !== latest.current)) {
        tried.current.delete(key);
        // Re-run the search: the stop is saved once saving is enabled again, even when nothing else changed.
        setAdvance((value) => value + 1);
        return;
      }
      if (accepted) {
        // Applied at once; the effect for the new plan picks up the next stop.
        own.current = accepted.plan;
        applyRef.current(accepted.plan);
        return;
      }
      // Refused or failed: the stop stays unsaved for this plan and the next stop is tried.
      setState((old) => ({ ...old, failed: new Set(old.failed).add(stop.id!) }));
      setAdvance((value) => value + 1);
    });
    // `advance` re-runs the search for the next stop after a save that did not commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, activities, placeIdFor, locationStatus, enabled, advance, currency, dataMode]);

  useEffect(
    () => () => {
      flight.current?.abort();
      flight.current = null;
    },
    [],
  );

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

/**
 * Sends one place edit, without routing its day: the day's legs are routed once after its last save
 * (see useLegRoutes). Resolves to the accepted plan, or to `undefined` when the server refused it,
 * failed, or the request was aborted. The caller decides whether the plan still applies.
 */
async function save(
  base: TripPlan,
  id: string,
  placeId: string,
  displayCurrency: string | undefined,
  dataMode: DataMode | undefined,
  signal: AbortSignal,
): Promise<{ plan: TripPlan; base: TripPlan } | undefined> {
  try {
    const answer = await requestPreview({
      plan: base,
      operation: { kind: "place", id, placeId, routeLater: true },
      displayCurrency,
      dataMode,
      signal,
    });
    return answer.plan ? { plan: answer.plan, base } : undefined;
  } catch {
    return undefined;
  }
}
