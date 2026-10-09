"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { useSettings } from "@/components/account/SettingsProvider";
import type { EditInput } from "@/lib/trip/trip-edit";
import type { Notice } from "@/lib/i18n/notice";
import type { DataMode } from "@/lib/workspace/data-mode";
import { requestPreview, type PreviewAnswer } from "./previewRequest";

export type EditOperation = EditInput["operation"];

/** What became of a background job, as the hook that offered it hears it. */
export type JobOutcome =
  /** The server answered for the revision the job was offered for: accepted (with a plan) or refused. */
  | { kind: "answer"; answer: PreviewAnswer }
  /** The request failed: a network error, a server error, or a refusal the server sent as an error. */
  | { kind: "failed"; error: unknown }
  /** The job was aborted, or the plan moved on, before its answer could apply. Nothing from it applies. */
  | { kind: "discarded" };

/** One background job: a request for one plan revision, and what its answer does to the hook that asked. */
export type BackgroundJob = {
  /** Names the work for the hook that offered it, such as one stop's save or one day's check. */
  key: string;
  /** The plan revision the job is for. Its answer applies only while that is still the current plan. */
  plan: TripPlan;
  operation: EditOperation;
  /** Receives the outcome. The hook keeps its own memory and its own notices here. */
  settled(outcome: JobOutcome): void;
};

/** What a traveller's edit became. An accepted edit is already applied when this resolves. */
export type EditResult =
  | { kind: "applied"; answer: PreviewAnswer & { plan: TripPlan } }
  /** The server refused the edit; the plan is unchanged. */
  | { kind: "refused"; blockers: Notice[] }
  /** The plan changed from elsewhere (chat, a restore) while the edit was being checked. Nothing applied. */
  | { kind: "stale" }
  /** A newer request or the trip changed first; this answer is not wanted. */
  | { kind: "superseded" };

export type PlanRevisions = {
  /**
   * Changes whenever background work may need to start again: a job settled, a traveller's edit ended, or the
   * work paused or resumed. A hook that wants a job reads it in an effect that depends on this value.
   */
  tick: number;
  /**
   * Offers a background job. It starts only when no other job is in flight for the trip, no edit or chat turn
   * is running, and the job's plan is still the current one. Resolves to whether it started.
   */
  offer(job: BackgroundJob): boolean;
  /**
   * Sends a traveller's edit for the current plan. It aborts the background job in flight first, so no
   * background answer can land while the edit is checked. An accepted edit is applied; `beforeApply` runs just
   * before, so the caller can record what the edit changed. Throws when the request fails.
   */
  edit(
    operation: EditOperation,
    options: {
      signal: AbortSignal;
      beforeApply?(answer: PreviewAnswer & { plan: TripPlan }): void;
      /** The notice shown when a failed request carries none of its own. */
      failure?: Notice;
    },
  ): Promise<EditResult>;
};

/**
 * The one owner of a trip's plan revisions and of its background work (spec #259, ticket #260). A plan
 * revision is the plan object a request was sent for. The rules, and the only place they live:
 *
 * - A traveller's edit wins. Starting one aborts the background job in flight at once, and its answer is
 *   discarded. Background work does not start while an edit, a place search or a chat turn is running
 *   (`held`).
 * - At most one background job is in flight per trip. When two are wanted, the first offered runs and the
 *   other is offered again once it settles.
 * - A background answer applies only when its revision is still the current plan. A discarded job is
 *   reported as discarded, so its hook can ask again for the current plan when it is still needed.
 *
 * The background hooks (auto-saved places, leg routes) and the edit hooks (timeline edits, the chooser)
 * are thin callers: they say what they want and what the answer means for them. See the Agent Note on one
 * owner for plan revisions and background work.
 */
export function usePlanRevision({
  plan,
  held,
  dataMode,
  onApply,
}: {
  plan: TripPlan | undefined;
  /** True while a chat turn, a place search or a traveller's edit is in flight: background work waits. */
  held: boolean;
  dataMode: DataMode | undefined;
  onApply(plan: TripPlan): void;
}): PlanRevisions {
  const { settings } = useSettings();
  const currency = settings.displayCurrency;
  const [tick, setTick] = useState(0);
  const latest = useRef(plan);
  latest.current = plan;
  const heldNow = useRef(held);
  heldNow.current = held;
  const requestContext = useRef({ currency, dataMode });
  requestContext.current = { currency, dataMode };
  const applyRef = useRef(onApply);
  applyRef.current = onApply;
  const editsInFlight = useRef(0);
  const flight = useRef<{ controller: AbortController } | undefined>(undefined);

  const bump = useCallback(() => setTick((value) => value + 1), []);

  // A new plan ends the job in flight, which was started for the plan before it.
  useEffect(() => () => flight.current?.controller.abort(), [plan]);
  // Work that is held (a chat turn, a search, an edit) stops at once and resumes when it is released.
  useEffect(() => {
    if (held) flight.current?.controller.abort();
    bump();
  }, [held, bump]);
  // A change of currency or data mode asks the work again, as it did when those were hook inputs.
  useEffect(() => {
    bump();
  }, [currency, dataMode, bump]);
  useEffect(() => () => flight.current?.controller.abort(), []);

  const finish = useCallback(
    (job: BackgroundJob, run: { controller: AbortController }, outcome: JobOutcome) => {
      if (flight.current === run) flight.current = undefined;
      const stillCurrent = !run.controller.signal.aborted && job.plan === latest.current;
      if (!stillCurrent) job.settled({ kind: "discarded" });
      else if (outcome.kind === "answer") {
        job.settled(outcome);
        if (outcome.answer.plan) applyRef.current(outcome.answer.plan);
      } else job.settled(outcome);
      bump();
    },
    [bump],
  );

  const offer = useCallback(
    (job: BackgroundJob) => {
      if (flight.current || heldNow.current || editsInFlight.current || job.plan !== latest.current)
        return false;
      const run = { controller: new AbortController() };
      flight.current = run;
      const { currency: displayCurrency, dataMode: mode } = requestContext.current;
      requestPreview({
        plan: job.plan,
        operation: job.operation,
        displayCurrency,
        dataMode: mode,
        signal: run.controller.signal,
      }).then(
        (answer) => finish(job, run, { kind: "answer", answer }),
        (error: unknown) => finish(job, run, { kind: "failed", error }),
      );
      return true;
    },
    [finish],
  );

  const edit = useCallback<PlanRevisions["edit"]>(
    async (operation, { signal, beforeApply, failure }) => {
      const base = latest.current;
      // No plan yet: there is nothing to edit.
      if (!base) return { kind: "stale" };
      flight.current?.controller.abort();
      editsInFlight.current += 1;
      try {
        const { currency: displayCurrency, dataMode: mode } = requestContext.current;
        const answer = await requestPreview({
          plan: base,
          operation,
          displayCurrency,
          dataMode: mode,
          signal,
          failure,
        });
        if (signal.aborted) return { kind: "superseded" };
        if (latest.current !== base) return { kind: "stale" };
        if (answer.blockers.length) return { kind: "refused", blockers: answer.blockers };
        const accepted = { ...answer, plan: answer.plan! };
        beforeApply?.(accepted);
        applyRef.current(accepted.plan);
        return { kind: "applied", answer: accepted };
      } catch (error) {
        if (signal.aborted) return { kind: "superseded" };
        throw error;
      } finally {
        editsInFlight.current -= 1;
        bump();
      }
    },
    [bump],
  );

  return useMemo(() => ({ tick, offer, edit }), [tick, offer, edit]);
}
