"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "../../account/LocaleProvider";

export type TripDraftField = "time" | "place" | "note" | "details" | "add";
export type TripDraftValue =
  | string
  | { start: string; end: string }
  | { detail: string; location: string }
  | Record<string, string | number | boolean | undefined>;

export type TripDraft = {
  tripId: string;
  stopId: string;
  stopName: string;
  day?: number;
  field: TripDraftField;
  base: TripDraftValue;
  value: TripDraftValue;
};

type DraftKey = `${string}:${string}:${TripDraftField}`;
type RestoreTarget = Pick<TripDraft, "tripId" | "stopId" | "field">;

type TripDrafts = {
  tripId: string;
  drafts: TripDraft[];
  restoreTarget?: RestoreTarget;
  get(key: DraftKey): TripDraft | undefined;
  change(draft: TripDraft): void;
  clear(stopId: string, field: TripDraftField): void;
  requestRestore(draft: TripDraft): void;
  consumeRestore(stopId: string, field: TripDraftField): void;
};

const Context = createContext<TripDrafts | undefined>(undefined);

export function TripDraftsProvider({ tripId, children }: { tripId: string; children: ReactNode }) {
  const [records, setRecords] = useState<Record<string, TripDraft>>({});
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget>();
  const get = useCallback((key: DraftKey) => records[key], [records]);
  const change = useCallback((draft: TripDraft) => {
    const key = `${draft.tripId}:${draft.stopId}:${draft.field}`;
    setRecords((current) => ({ ...current, [key]: draft }));
  }, []);
  const clear = useCallback(
    (stopId: string, field: TripDraftField) => {
      const key = `${tripId}:${stopId}:${field}`;
      setRecords((current) => {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
      setRestoreTarget((target) =>
        target?.tripId === tripId && target.stopId === stopId && target.field === field
          ? undefined
          : target,
      );
    },
    [tripId],
  );
  const requestRestore = useCallback((draft: TripDraft) => {
    setRestoreTarget({ tripId: draft.tripId, stopId: draft.stopId, field: draft.field });
  }, []);
  const consumeRestore = useCallback(
    (stopId: string, field: TripDraftField) => {
      setRestoreTarget((target) =>
        target?.tripId === tripId && target.stopId === stopId && target.field === field
          ? undefined
          : target,
      );
    },
    [tripId],
  );
  const drafts = useMemo(
    () => Object.values(records).filter((draft) => draft.tripId === tripId),
    [records, tripId],
  );
  const value = useMemo(
    () => ({ tripId, drafts, restoreTarget, get, change, clear, requestRestore, consumeRestore }),
    [tripId, drafts, restoreTarget, get, change, clear, requestRestore, consumeRestore],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function useController() {
  const controller = useContext(Context);
  if (!controller)
    throw new Error("TripDraftsProvider must wrap the shared Trip workspace and its Trip surfaces");
  return controller;
}

function same(left: TripDraftValue, right: TripDraftValue) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useTripDraftField<T extends TripDraftValue>({
  stopId,
  stopName,
  day,
  field,
  initial,
}: {
  stopId: string;
  stopName: string;
  day?: number;
  field: TripDraftField;
  initial: T;
}) {
  const controller = useController();
  const key = `${controller.tripId}:${stopId}:${field}` as DraftKey;
  const draft = controller.get(key);
  const value = (draft?.value ?? initial) as T;
  const dirty = !same(value, initial);
  const stale = !!draft && !same(draft.base, initial);
  const setValue = useCallback(
    (next: T) => {
      if (same(next, initial)) {
        controller.clear(stopId, field);
        return;
      }
      controller.change({
        tripId: controller.tripId,
        stopId,
        stopName,
        ...(day === undefined ? {} : { day }),
        field,
        base: draft?.base ?? initial,
        value: next,
      });
    },
    [controller, day, draft, field, initial, stopId, stopName],
  );
  const clear = useCallback(() => controller.clear(stopId, field), [controller, field, stopId]);
  const rebase = useCallback(() => {
    if (!draft) return;
    if (same(draft.value, initial)) {
      controller.clear(stopId, field);
      return;
    }
    controller.change({ ...draft, base: initial, stopName, day });
  }, [controller, day, draft, field, initial, stopId, stopName]);
  return { value, dirty, stale, setValue, clear, rebase };
}

export function useTripDraftRestore(stopId: string) {
  const controller = useController();
  const target = controller.restoreTarget;
  const consume = useCallback(
    (field: TripDraftField) => controller.consumeRestore(stopId, field),
    [controller, stopId],
  );
  return {
    target: target?.tripId === controller.tripId && target.stopId === stopId ? target : undefined,
    consume,
  };
}

export function TripDraftRestoreEntry({ onRestore }: { onRestore(draft: TripDraft): void }) {
  const controller = useController();
  const { t } = useLocale();
  if (!controller.drafts.length) return null;
  const label = (draft: TripDraft) =>
    draft.field === "time"
      ? t("Change time")
      : draft.field === "place"
        ? t("Find this place")
        : draft.field === "details"
          ? t("Edit details")
          : draft.field === "add"
            ? t("Add a stop")
            : t("Note");
  return (
    <aside className="trip-draft-restore" aria-label={t("Unfinished trip edits")}>
      {controller.drafts.map((draft) => (
        <button
          key={`${draft.stopId}:${draft.field}`}
          type="button"
          onClick={() => {
            controller.requestRestore(draft);
            onRestore(draft);
          }}
        >
          <span>{draft.stopName}</span>
          <span>{t("Continue editing {v0}", { v0: label(draft) })}</span>
        </button>
      ))}
    </aside>
  );
}
