"use client";
import { useEffect, useRef, useState } from "react";
import { TripPlan } from "@trip/shared";
import { useSettings } from "@/components/account/SettingsProvider";
import { failureNotice, type Notice } from "@/lib/i18n/notice";

/**
 * Swap a stay or fare for one the specialist already found.
 *
 * Through the edit route rather than in the browser: the server owns the budget roll-up and the
 * conflict check, and "never trust client totals" applies to a price the traveller picked as much
 * as to one they typed.
 *
 * Failure inventory this was written from:
 * - the traveller opens another trip, or the plan changes, while the swap is in flight, and the
 *   late response overwrites the newer plan;
 * - a second tap sends a second swap against the same base version;
 * - planning starts while a swap is in flight;
 * - a failure reads in English in the Chinese interface.
 */
export function useChooseCandidate(
  plan: TripPlan | undefined,
  onApply: (next: TripPlan) => void,
  onPending: (pending: boolean) => void,
) {
  const { settings } = useSettings();
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<Notice>();
  const request = useRef<AbortController | undefined>(undefined);

  // Any newer plan, another trip's included, makes an in-flight swap stale.
  useEffect(() => () => request.current?.abort(), [plan]);

  async function choose(section: string, selectionId: string, candidateId: string) {
    if (!plan || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setWorking(true);
    setProblem(undefined);
    onPending(true);
    try {
      const response = await fetch("/api/trip/preview-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          baseVersion: plan.editVersion ?? 0,
          operation: { kind: "choose", section, selectionId, candidateId },
          displayCurrency: settings.displayCurrency,
        }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setProblem(failureNotice(body, { key: "That change could not be made." }));
        return;
      }
      onApply(TripPlan.parse(body.plan));
    } catch {
      if (!controller.signal.aborted) setProblem({ key: "That change could not be made." });
    } finally {
      if (request.current === controller) request.current = undefined;
      setWorking(false);
      onPending(false);
    }
  }

  return { choose, working, problem };
}
