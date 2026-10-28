"use client";
import { useEffect, useRef, useState } from "react";
import type { ProposalItem } from "@trip/shared";
import type { Notice } from "@/lib/i18n/notice";
import type { ItemAction } from "@/lib/trip/item-actions";
import { useLocale } from "../../account/LocaleProvider";
import { SearchIcon } from "../../ui/icons";
import type { TimelineEdits } from "./useTimelineEdits";
import { StopEditSurface } from "./StopEditSurface";

type Activity = ProposalItem & { id?: string };

export function TimeForm({
  id,
  start,
  end,
  locked,
  validTime,
  timeChanged,
  errors = [],
  onStart,
  onEnd,
  onSubmit,
  onCancel,
}: {
  id: string;
  start: string;
  end: string;
  locked: boolean;
  validTime: boolean;
  timeChanged: boolean;
  errors?: Notice[];
  onStart(value: string): void;
  onEnd(value: string): void;
  onSubmit(): boolean | Promise<boolean>;
  onCancel(): void;
}) {
  const { t } = useLocale();
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <form
      id={`stop-time-${id}`}
      className="stop-editor stop-editor__group stop-editor__time"
      onSubmit={(event) => {
        event.preventDefault();
        if (validTime && timeChanged) void onSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
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
      <button type="submit" className="primary" disabled={locked || !timeChanged || !validTime}>
        {t("Change time")}
      </button>
      <button type="button" onClick={onCancel}>
        {t("Cancel")}
      </button>
      {!validTime && <p className="stop-editor__hint">{t("End must be after start.")}</p>}
      <EditErrors errors={errors} />
    </form>
  );
}

export function ItemForm({
  activity,
  mode,
  days,
  labels,
  onSubmit,
  onCancel,
}: {
  activity: Activity;
  mode: "details" | "note" | "schedule";
  days: number;
  labels: string[];
  onSubmit(action: ItemAction): boolean | Promise<boolean>;
  onCancel(): void;
}) {
  const { t } = useLocale();
  const [detail, setDetail] = useState(activity.detail);
  const [location, setLocation] = useState(activity.location ?? "");
  const [note, setNote] = useState(activity.note ?? "");
  const [day, setDay] = useState(1);
  const [failed, setFailed] = useState(false);
  const validDay = mode !== "schedule" || (day >= 1 && day <= days);
  const first = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
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
        if (!validDay) return;
        void Promise.resolve(onSubmit(action)).then((done) => setFailed(!done));
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
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
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label>
            {t("What you will do")}
            <textarea
              value={detail}
              maxLength={500}
              rows={2}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
        </>
      )}
      {mode === "note" && (
        <label>
          {t("Comment")}
          <textarea
            ref={first}
            value={note}
            maxLength={500}
            rows={2}
            placeholder={t("e.g. Book tickets a day ahead")}
            onChange={(e) => setNote(e.target.value)}
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
            onChange={(e) => setDay(Number(e.target.value))}
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
      <div className="item-editor__actions">
        <button type="submit" className="primary" disabled={!validDay}>
          {mode === "schedule" ? t("Schedule") : t("Save")}
        </button>
        <button type="button" onClick={onCancel}>
          {t("Cancel")}
        </button>
      </div>
    </form>
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
}: {
  label: string;
  locked: boolean;
  edits: TimelineEdits;

  focusOnMount?: boolean;
  phone: boolean;
  onUse(placeId: string): boolean | Promise<boolean>;
  onCancel?(): void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
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
          onCancel();
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
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        <button type="submit" disabled={locked || !query.trim()}>
          {t("Search")}
        </button>
      </form>
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
                disabled={locked}
                aria-label={t("Use {v0}", { v0: result.displayName?.text ?? "this place" })}
                onClick={() => void onUse(result.id)}
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
    <StopEditSurface phone={phone} title={label} onClose={onCancel}>
      {content}
    </StopEditSurface>
  ) : (
    content
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
