"use client";
import { useCallback, useEffect, useState } from "react";
import { effectiveCurrency, type ProposalItem, type TripPlan } from "@trip/shared";
import { useSettings } from "@/components/account/SettingsProvider";
import { settlePlan } from "@/lib/trip/settle";
import type { Notice } from "@/lib/i18n/notice";
import type { EditOperation } from "./plan-revision";

type UndoStep = { previous: TripPlan; message: Notice } | { operation: EditOperation };
type UndoRecord = { appliedPlanFingerprint: string; step: UndoStep };

export function useTripUndo(plan: TripPlan | undefined) {
  const { settings } = useSettings();
  const [records, setRecords] = useState<{ [tripId: string]: UndoRecord }>({});
  const tripId = plan?.tripId ?? "";
  const fingerprint = JSON.stringify(plan);
  const record = records[tripId];
  const step = record && record.appliedPlanFingerprint === fingerprint ? record.step : undefined;
  const clear = useCallback(() => {
    setRecords((current) => {
      if (!current[tripId]) return current;
      const next = { ...current };
      delete next[tripId];
      return next;
    });
  }, [tripId]);
  useEffect(() => {
    if (record && record.appliedPlanFingerprint !== fingerprint) clear();
  }, [clear, fingerprint, record]);
  return {
    step,
    record(next: TripPlan, value: UndoStep) {
      setRecords((current) => ({
        ...current,
        [next.tripId]: { appliedPlanFingerprint: JSON.stringify(next), step: value },
      }));
    },
    preserveBackground(previous: TripPlan, next: TripPlan) {
      setRecords((current) => {
        const entry = current[previous.tripId];
        if (!entry || entry.appliedPlanFingerprint !== JSON.stringify(previous)) return current;
        const step = structuredClone(entry.step);
        const before = previous.sections.find((s) => s.id === "itinerary")?.proposal;
        const after = next.sections.find((s) => s.id === "itinerary")?.proposal;
        if ("previous" in step) {
          const restored = step.previous;
          const target = restored.sections.find((s) => s.id === "itinerary")?.proposal;
          for (const item of target?.items ?? []) enrich(item);
          if (before && after && target) carryUnchanged(target, before, after, ["conflictsWith"]);
          carryUnchanged(restored, previous, next, ["editIssues"]);
          settlePlan(
            restored,
            next.editVersion ?? 0,
            effectiveCurrency(restored.brief, settings.displayCurrency),
          );
        } else if (step.operation.kind === "undo") {
          for (const item of step.operation.activities) enrich(item);
        }
        function enrich(
          target: Pick<
            ProposalItem,
            | "id"
            | "day"
            | "startTime"
            | "endTime"
            | "placeId"
            | "savedPlace"
            | "priceNeedsReview"
            | "arriveBy"
          >,
        ) {
          const old = before?.items.find((item) => item.id === target.id);
          const updated = after?.items.find((item) => item.id === target.id);
          if (!old || !updated || target.placeId !== old.placeId) return;
          if (
            target.day === old.day &&
            target.startTime === old.startTime &&
            target.endTime === old.endTime
          )
            carryUnchanged(target, old, updated, ["arriveBy"]);
          carryUnchanged(target, old, updated, ["placeId", "savedPlace", "priceNeedsReview"]);
        }
        return {
          ...current,
          [next.tripId]: { appliedPlanFingerprint: JSON.stringify(next), step },
        };
      });
    },
    clear,
  };
}

export type TripUndo = ReturnType<typeof useTripUndo>;

function carryUnchanged<T extends object, K extends keyof T>(
  target: T,
  before: T,
  after: T,
  keys: K[],
) {
  for (const key of keys) {
    if (JSON.stringify(target[key]) !== JSON.stringify(before[key])) continue;
    if (after[key] === undefined) delete target[key];
    else target[key] = after[key];
  }
}
