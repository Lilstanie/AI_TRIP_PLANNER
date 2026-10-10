"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { useSettings } from "@/components/account/SettingsProvider";
import type { EditInput } from "@/lib/trip/trip-edit";
import { NoticeError, type Notice } from "@/lib/i18n/notice";
import type { DataMode } from "@/lib/workspace/data-mode";
import {
  withTabPlan,
  STALE_PLAN,
  publishTabPlan,
  seedTabPlan,
  isCurrentTabPlan,
} from "@/lib/trip/tab-revision";
import { requestPreview, type PreviewAnswer } from "./previewRequest";

export type EditOperation = EditInput["operation"];

export const PLAN_CHANGED: Notice = {
  key: "The plan changed while this change was being checked. Try the change again.",
};

export type JobOutcome =
  | { kind: "answer"; answer: PreviewAnswer }
  | { kind: "failed"; error: unknown }
  | { kind: "discarded" };

export type BackgroundJob = {
  key: string;

  plan: TripPlan;
  operation: EditOperation;

  settled(outcome: JobOutcome): void;
};

export type EditResult =
  | { kind: "applied"; answer: PreviewAnswer & { plan: TripPlan } }
  | { kind: "refused"; blockers: Notice[] }
  | { kind: "stale" }
  | { kind: "superseded" };

export type PlanRevisions = {
  tick: number;

  stale?: Notice;

  offer(job: BackgroundJob): boolean;

  edit(
    operation: EditOperation,
    options: {
      signal: AbortSignal;
      beforeApply?(answer: PreviewAnswer & { plan: TripPlan }): void;

      failure?: Notice;
    },
  ): Promise<EditResult>;
};

export function usePlanRevision({
  plan,
  held,
  dataMode,
  onApply,
}: {
  plan: TripPlan | undefined;

  held: boolean;
  dataMode: DataMode | undefined;
  onApply(plan: TripPlan): void;
}): PlanRevisions {
  const { settings } = useSettings();
  const currency = settings.displayCurrency;
  const [tick, setTick] = useState(0);
  const [stalePlan, setStalePlan] = useState<TripPlan>();
  const refusedPlan = useRef<TripPlan | undefined>(undefined);
  const published = useRef<TripPlan | undefined>(undefined);
  useEffect(() => {
    if (plan) {
      if (!published.current || published.current.tripId !== plan.tripId) seedTabPlan(plan);
      else if (published.current !== plan) publishTabPlan(plan);
    }
    published.current = plan;
  }, [plan]);
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

  useEffect(() => () => flight.current?.controller.abort(), [plan]);

  useEffect(() => {
    if (held) flight.current?.controller.abort();
    bump();
  }, [held, bump]);

  useEffect(() => {
    bump();
  }, [currency, dataMode, bump]);
  useEffect(() => () => flight.current?.controller.abort(), []);

  const finish = useCallback(
    (job: BackgroundJob, run: { controller: AbortController }, outcome: JobOutcome) => {
      if (flight.current === run) flight.current = undefined;
      const locallyReplaced = run.controller.signal.aborted || job.plan !== latest.current;
      if (locallyReplaced) job.settled({ kind: "discarded" });
      else if (!isCurrentTabPlan(job.plan)) {
        refusedPlan.current = job.plan;
        setStalePlan(job.plan);
        job.settled({
          kind: "failed",
          error: new NoticeError(STALE_PLAN),
        });
      } else if (outcome.kind === "answer") {
        job.settled(outcome);
        if (outcome.answer.plan) {
          publishTabPlan(outcome.answer.plan);
          applyRef.current(outcome.answer.plan);
        }
      } else job.settled(outcome);
      bump();
    },
    [bump],
  );

  const offer = useCallback(
    (job: BackgroundJob) => {
      if (
        flight.current ||
        heldNow.current ||
        editsInFlight.current ||
        job.plan !== latest.current ||
        job.plan === refusedPlan.current
      )
        return false;
      const run = { controller: new AbortController() };
      flight.current = run;
      const { currency: displayCurrency, dataMode: mode } = requestContext.current;
      withTabPlan(job.plan, run.controller.signal, async () => {
        const answer = await requestPreview({
          plan: job.plan,
          operation: job.operation,
          displayCurrency,
          dataMode: mode,
          signal: run.controller.signal,
        });
        finish(job, run, { kind: "answer", answer });
      }).then(
        () => undefined,
        (error: unknown) => finish(job, run, { kind: "failed", error }),
      );
      return true;
    },
    [finish],
  );

  const edit = useCallback<PlanRevisions["edit"]>(
    async (operation, { signal, beforeApply, failure }) => {
      const base = latest.current;

      if (!base) return { kind: "stale" };
      flight.current?.controller.abort();
      editsInFlight.current += 1;
      try {
        const { currency: displayCurrency, dataMode: mode } = requestContext.current;
        return await withTabPlan(base, signal, async (): Promise<EditResult> => {
          const answer = await requestPreview({
            plan: base,
            operation,
            displayCurrency,
            dataMode: mode,
            signal,
            failure,
          });
          if (signal.aborted) return { kind: "superseded" };
          if (latest.current !== base || !isCurrentTabPlan(base)) return { kind: "stale" };
          if (answer.blockers.length) return { kind: "refused", blockers: answer.blockers };
          const accepted = { ...answer, plan: answer.plan! };
          beforeApply?.(accepted);
          publishTabPlan(accepted.plan);
          applyRef.current(accepted.plan);
          return { kind: "applied", answer: accepted };
        });
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

  const stale: Notice | undefined = stalePlan && stalePlan === plan ? STALE_PLAN : undefined;
  return useMemo(() => ({ tick, offer, edit, stale }), [tick, offer, edit, stale]);
}
