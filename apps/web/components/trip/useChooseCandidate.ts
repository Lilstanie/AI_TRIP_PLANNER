"use client";
import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { NoticeError, type Notice } from "@/lib/i18n/notice";
import { PLAN_CHANGED, type PlanRevisions } from "./plan-revision";

export function useChooseCandidate(
  plan: TripPlan | undefined,
  revisions: PlanRevisions,
  onPending: (pending: boolean) => void,
) {
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<Notice>();
  const request = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => request.current?.abort(), []);

  async function choose(section: string, selectionId: string, candidateId: string) {
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
