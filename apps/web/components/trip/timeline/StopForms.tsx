"use client";
import { useEffect, useRef, useState } from "react";
import type { ProposalItem } from "@trip/shared";
import type { Notice } from "@/lib/i18n/notice";
import type { ItemAction } from "@/lib/trip/item-actions";
import { useLocale } from "../../account/LocaleProvider";
import { SearchIcon } from "../../ui/icons";
import { useDiscardChanges } from "../../ui/useDiscardChanges";
import { useTripDraftField } from "./TripDrafts";
import type { TimelineEdits } from "./useTimelineEdits";
import { StopEditSurface } from "./StopEditSurface";

type Activity = ProposalItem & { id?: string };

export function TimeForm({
  id,
  start,
  end,
  locked,
  phone,
  validTime,
  timeChanged,
  errors = [],
  onStart,
  onEnd,
  onSubmit,
  onCancel,
  onDiscard,
  stale = false,
  onRebase,
}: {
  id: string;
  start: string;
  end: string;
  locked: boolean;
  phone: boolean;
  validTime: boolean;
  timeChanged: boolean;
  errors?: Notice[];
  onStart(value: string): void;
  onEnd(value: string): void;
  onSubmit(): boolean | Promise<boolean>;
  onCancel(): void;
  onDiscard(): void;
  stale?: boolean;
  onRebase?(): void;
}) {
  const { t } = useLocale();
  const { requestClose, confirmation } = useDiscardChanges(timeChanged);
  const close = () =>
    requestClose(() => {
      onDiscard();
      onCancel();
    });
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <>
      <StopEditSurface phone={phone} title={t("Change time")} onClose={close}>
        <form
          id={`stop-time-${id}`}
          className="stop-editor stop-editor__group stop-editor__time"
          onSubmit={(event) => {
            event.preventDefault();
            if (validTime && timeChanged && !stale) void onSubmit();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            close();
          }}
        >
          <label>
            {t("Start")}
            <input
              ref={first}
              type="time"
              required
              value={start}
              disabled={locked}
              onChange={(event) => onStart(event.target.value)}
            />
          </label>
          <label>
            {t("End")}
            <input
              type="time"
              required
              value={end}
              disabled={locked}
              onChange={(event) => onEnd(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="primary"
            disabled={locked || !timeChanged || !validTime || stale}
          >
            {t("Change time")}
          </button>
          <button type="button" onClick={close}>
            {t("Cancel")}
          </button>
          {stale && <DraftStaleNotice onRebase={onRebase} />}
          {!validTime && <p className="stop-editor__hint">{t("End must be after start.")}</p>}
          <EditErrors errors={errors} />
        </form>
      </StopEditSurface>
      {confirmation}
    </>
  );
}

export function ItemForm({
  activity,
  mode,
  days,
  labels,
  phone,
  onSubmit,
  onCancel,
}: {
  activity: Activity;
  mode: "details" | "note" | "schedule";
  days: number;
  labels: string[];
  phone: boolean;
  onSubmit(action: ItemAction): boolean | Promise<boolean>;
  onCancel(): void;
}) {
  const { t } = useLocale();
  const detailsDraft = useTripDraftField({
    stopId: activity.id!,
    stopName: activity.location ?? activity.detail,
    day: activity.day,
    field: "details",
    initial: { detail: activity.detail, location: activity.location ?? "" },
  });
  const noteDraft = useTripDraftField({
    stopId: activity.id!,
    stopName: activity.location ?? activity.detail,
    day: activity.day,
    field: "note",
    initial: activity.note ?? "",
  });
  const detail = detailsDraft.value.detail;
  const location = detailsDraft.value.location;
  const note = noteDraft.value;
  const scheduleDraft = useTripDraftField({
    stopId: activity.id!,
    stopName: activity.location ?? activity.detail,
    day: activity.day,
    field: "schedule",
    initial: { day: 1 },
    baseline: { day: activity.day, days },
  });
  const day = scheduleDraft.value.day;
  const [failed, setFailed] = useState(false);
  const activeDraft =
    mode === "details" ? detailsDraft : mode === "note" ? noteDraft : scheduleDraft;
  const dirty = activeDraft.dirty;
  const stale = activeDraft.stale;
  const validDay = mode !== "schedule" || (day >= 1 && day <= days);
  const { requestClose, confirmation } = useDiscardChanges(dirty);
  const close = () =>
    requestClose(() => {
      activeDraft.clear();
      onCancel();
    });
  const first = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <>
      <StopEditSurface
        title={t(
          mode === "details" ? "Edit details" : mode === "note" ? "Note" : "Schedule on a day",
        )}
        complex={mode === "details"}
        phone={phone}
        onClose={close}
      >
        <form
          className="item-editor"
          onSubmit={(event) => {
            event.preventDefault();
            const action: ItemAction =
              mode === "details"
                ? { kind: "details", detail, location }
                : mode === "note"
                  ? { kind: "note", note }
                  : { kind: "day", day };
            if (stale || !validDay) return;
            void Promise.resolve(onSubmit(action)).then((done) => {
              setFailed(!done);
              if (done) activeDraft.clear();
            });
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            close();
          }}
        >
          {mode === "details" && (
            <>
              <label>
                {t("Place name")}
                <input
                  ref={first}
                  value={location}
                  maxLength={120}
                  onChange={(e) => detailsDraft.setValue({ detail, location: e.target.value })}
                />
              </label>
              <label>
                {t("What you will do")}
                <textarea
                  value={detail}
                  maxLength={500}
                  rows={2}
                  onChange={(e) => detailsDraft.setValue({ detail: e.target.value, location })}
                />
              </label>
            </>
          )}
          {mode === "note" && (
            <label>
              {t("Note")}
              <textarea
                ref={first}
                value={note}
                maxLength={500}
                rows={2}
                placeholder={t("e.g. Book tickets a day ahead")}
                onChange={(e) => noteDraft.setValue(e.target.value)}
              />
            </label>
          )}
          {mode === "schedule" && (
            <label>
              {t("Day")}
              <select
                ref={first}
                aria-label={t("Day")}
                value={day}
                onChange={(e) => scheduleDraft.setValue({ day: Number(e.target.value) })}
              >
                {Array.from({ length: days }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {t("Day {v0}", { v0: index + 1 })} · {labels[index]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {failed && <EditErrors errors={[{ key: "Something went wrong. Try again." }]} />}
          {stale && <DraftStaleNotice onRebase={activeDraft.rebase} />}
          <div className="item-editor__actions">
            <button type="submit" className="primary" disabled={stale || !validDay}>
              {mode === "schedule" ? t("Schedule") : t("Save")}
            </button>
            <button type="button" onClick={close}>
              {t("Cancel")}
            </button>
          </div>
        </form>
      </StopEditSurface>
      {confirmation}
    </>
  );
}

export function PlaceSearch({
  label,
  locked,
  edits,
  focusOnMount = false,
  phone,
  onUse,
  onCancel,
  stopId,
  stopName,
  day,
  baseline,
}: {
  label: string;
  locked: boolean;
  edits: TimelineEdits;

  focusOnMount?: boolean;
  phone: boolean;
  onUse(placeId: string): boolean | Promise<boolean>;
  onCancel?(): void;
  stopId: string;
  stopName: string;
  day?: number;
  baseline?: string;
}) {
  const { t } = useLocale();
  const queryDraft = useTripDraftField({
    stopId,
    stopName,
    day,
    field: "place",
    initial: "" as string,
    baseline,
  });
  const query = queryDraft.value;
  const { requestClose, confirmation } = useDiscardChanges(queryDraft.dirty);
  const close = () =>
    requestClose(() => {
      queryDraft.clear();
      onCancel?.();
    });
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusOnMount) input.current?.focus();
  }, [focusOnMount]);
  const content = (
    <>
      <form
        className="stop-editor__group stop-editor__search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) void edits.search(query.trim());
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !onCancel) return;
          event.preventDefault();
          event.stopPropagation();
          close();
        }}
      >
        <label>
          {label}
          <span className="stop-editor__search-field">
            <SearchIcon />
            <input
              ref={input}
              type="search"
              value={query}
              placeholder={t("Search Google Maps")}
              disabled={locked}
              onChange={(event) => queryDraft.setValue(event.target.value)}
            />
          </span>
        </label>
        <button type="submit" disabled={locked || !query.trim()}>
          {t("Search")}
        </button>
      </form>
      {queryDraft.stale && <DraftStaleNotice onRebase={queryDraft.rebase} />}
      <EditErrors errors={edits.errors} />
      {!!edits.results.length && (
        <ul className="stop-editor__results" aria-label={t("Place results")}>
          {edits.results.map((result) => (
            <li key={result.id}>
              <span>
                <strong>{result.displayName?.text ?? t("Unnamed place")}</strong>
                <small>{result.formattedAddress ?? t("Address unavailable")}</small>
              </span>
              <button
                type="button"
                disabled={locked || queryDraft.stale}
                aria-label={t("Use {v0}", { v0: result.displayName?.text ?? "this place" })}
                onClick={async () => {
                  const saved = await onUse(result.id);
                  if (saved) queryDraft.clear();
                }}
              >
                {t("Use")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
  return onCancel ? (
    <>
      <StopEditSurface phone={phone} title={label} onClose={close}>
        {content}
      </StopEditSurface>
      {confirmation}
    </>
  ) : (
    content
  );
}

export function DraftStaleNotice({ onRebase }: { onRebase?(): void }) {
  const { t } = useLocale();
  return (
    <p className="stop-editor__hint" role="status">
      {t("Draft changed since you started editing")}{" "}
      {onRebase && (
        <button type="button" onClick={onRebase}>
          {t("Use latest trip and retry")}
        </button>
      )}
    </p>
  );
}

function EditErrors({ errors }: { errors: Notice[] }) {
  const { notice } = useLocale();
  if (!errors.length) return null;
  return (
    <div role="alert" className="stop-editor__errors">
      {errors.map((error, index) => (
        <p key={index}>{notice(error)}</p>
      ))}
    </div>
  );
}
