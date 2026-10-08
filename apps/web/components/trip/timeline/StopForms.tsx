"use client";
import { useEffect, useRef, useState } from "react";
import type { ProposalItem } from "@trip/shared";
import type { ItemAction } from "@/lib/trip/item-actions";
import { useLocale } from "../../account/LocaleProvider";
import { SearchIcon } from "../../ui/icons";
import type { TimelineEdits } from "./useTimelineEdits";

type Activity = ProposalItem & { id?: string };

/**
 * The start and end of a stop, shown when its time is tapped. Submitting sends the change to the
 * server check; Escape closes the form and the caller returns focus to the time it came from.
 */
export function TimeForm({
  id,
  start,
  end,
  locked,
  validTime,
  timeChanged,
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
  onStart(value: string): void;
  onEnd(value: string): void;
  onSubmit(): void;
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
        if (validTime && timeChanged) onSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
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
      {!validTime && <p className="stop-editor__hint">{t("End must be after start.")}</p>}
    </form>
  );
}

/**
 * The small form in a stop's place card for its details, its note, or scheduling an idea on a day.
 * It opens from the stop's menu, takes focus, and Escape or Cancel closes it without changing the stop.
 */
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
  onSubmit(action: ItemAction): void;
  onCancel(): void;
}) {
  const { t } = useLocale();
  const [detail, setDetail] = useState(activity.detail);
  const [location, setLocation] = useState(activity.location ?? "");
  const [note, setNote] = useState(activity.note ?? "");
  const [day, setDay] = useState(1);
  const first = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <form
      className="item-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (mode === "details") onSubmit({ kind: "details", detail, location });
        else if (mode === "note") onSubmit({ kind: "note", note });
        else onSubmit({ kind: "day", day });
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
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
          {t("Note")}
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
      <div className="item-editor__actions">
        <button type="submit" className="primary">
          {mode === "schedule" ? t("Schedule") : t("Save")}
        </button>
        <button type="button" onClick={onCancel}>
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}

/**
 * Google Places text search for a stop's place. A picked result is saved through the server check
 * by `onUse`. The search lives in the place card; Escape closes it through `onCancel`.
 */
export function PlaceSearch({
  label,
  locked,
  edits,
  focusOnMount = false,
  onUse,
  onCancel,
}: {
  label: string;
  locked: boolean;
  edits: TimelineEdits;
  /** Take focus when the search opens from the stop's menu, not when a stop is only selected. */
  focusOnMount?: boolean;
  onUse(placeId: string): void;
  onCancel?(): void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusOnMount) input.current?.focus();
  }, [focusOnMount]);
  return (
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
                onClick={() => onUse(result.id)}
              >
                {t("Use")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
