"use client";
import { useCallback, useEffect, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { Notice } from "@/lib/i18n/notice";
import type { EditOperation } from "./plan-revision";

type UndoStep = { previous: TripPlan; message: Notice } | { operation: EditOperation };
type UndoRecord = { applied: string; step: UndoStep };

export function useTripUndo(plan: TripPlan | undefined) {
  const [records, setRecords] = useState<{ [tripId: string]: UndoRecord }>({});
  const tripId = plan?.tripId ?? "";
  const fingerprint = JSON.stringify(plan);
  const record = records[tripId];
  const step = record && record.applied === fingerprint ? record.step : undefined;
  const clear = useCallback(() => {
    setRecords((current) => {
      if (!current[tripId]) return current;
      const next = { ...current };
      delete next[tripId];
      return next;
    });
  }, [tripId]);
  useEffect(() => {
    if (record && record.applied !== fingerprint) clear();
  }, [clear, fingerprint, record]);
  return {
    step,
    record(next: TripPlan, value: UndoStep) {
      setRecords((current) => ({
        ...current,
        [next.tripId]: { applied: JSON.stringify(next), step: value },
      }));
    },
    clear,
  };
}

export type TripUndo = ReturnType<typeof useTripUndo>;
