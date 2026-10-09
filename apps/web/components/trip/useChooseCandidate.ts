"use client";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { NoticeError, type Notice } from "@/lib/i18n/notice";
import { PLAN_CHANGED, type PlanRevisions } from "./plan-revision";

/**
 * Swap a stay or fare for one the specialist already found.
 *
 * Through the edit route rather than in the browser: the server owns the budget roll-up and the
 * conflict check, and "never trust client totals" applies to a price the traveller picked as much
 * as to one they typed. The swap is a traveller's edit, so the plan revision owner sends it and applies it.
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
  revisions: PlanRevisions,
  onPending: (pending: boolean) => void,
) {
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<Notice>();
  const request = useRef<AbortController | undefined>(undefined);

  // A swap in flight when the plan changes is judged when it answers: the plan revision owner refuses it as stale
  // and the chooser says so. It is only abandoned when the chooser itself goes away.
  useEffect(() => () => request.current?.abort(), []);

  async function choose(section: string, selectionId: string, candidateId: string) {
    // The server checks the section name and answers an unknown one with its own notice.
    const sectionName = section as "accommodation" | "transport";
    if (!plan || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setWorking(true);
    setProblem(undefined);
    onPending(true);
    try {
      const result = await revisions.edit(
        { kind: "choose", section: sectionName, selectionId, candidateId },
        { signal: controller.signal, failure: { key: "That change could not be made." } },
      );
      // Refused, or stale: the swap is not applied and the traveller is told why.
      if (result.kind === "refused")
        setProblem(result.blockers[0] ?? { key: "That change could not be made." });
      else if (result.kind === "stale") setProblem(PLAN_CHANGED);
    } catch (error) {
      if (!controller.signal.aborted)
        setProblem(
          error instanceof NoticeError ? error.notice : { key: "That change could not be made." },
        );
    } finally {
      if (request.current === controller) request.current = undefined;
      setWorking(false);
      onPending(false);
    }
  }

  return { choose, working, problem };
}
