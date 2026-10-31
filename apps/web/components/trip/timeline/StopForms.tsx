"use client";
import { useEffect, useRef, useState } from "react";
import type { ProposalItem } from "@trip/shared";
import type { Notice } from "@/lib/i18n/notice";
import type { ItemAction } from "@/lib/trip/item-actions";
import { useLocale } from "../../account/LocaleProvider";
import { SearchIcon } from "../../ui/icons";
import type { TimelineEdits } from "./useTimelineEdits";
import { StopEditSurface } from "./StopEditSurface";
import { useEditorDraft } from "../editor-drafts";

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
        {t("start")}
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
        {t("end")}
        <input
          type="time"
          required
          value={end}
          disabled={locked}
          onChange={(event) => onEnd(event.target.value)}
        />
      </label>
      <button type="submit" className="primary" disabled={locked || !timeChanged || !validTime}>
        {t("changeTime")}
      </button>
      <button type="button" onClick={onCancel}>
        {t("cancel")}
      </button>
      {!validTime && <p className="stop-editor__hint">{t("endMustBeAfterStart")}</p>}
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
  const key = `${activity.id}:${mode}`;
  const [detail, setDetail, resetDetail] = useEditorDraft(`${key}:detail`, activity.detail);
  const [location, setLocation, resetLocation] = useEditorDraft(
    `${key}:location`,
    activity.location ?? "",
  );
  const [note, setNote, resetNote] = useEditorDraft(`${key}:note`, activity.note ?? "");
  const [day, setDay, resetDay] = useEditorDraft(`${key}:day`, 1);
  const reset = () => {
    resetDetail();
    resetLocation();
    resetNote();
    resetDay();
  };
  const cancel = () => {
    reset();
    onCancel();
  };
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
        void Promise.resolve(onSubmit(action)).then((done) => {
          if (done) reset();
          setFailed(!done);
        });
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }}
    >
      {mode === "details" && (
        <>
          <label>
            {t("placeName")}
            <input
              ref={first}
              value={location}
              maxLength={120}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label>
            {t("whatYouWillDo")}
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
          {t("comment")}
          <textarea
            ref={first}
            value={note}
            maxLength={500}
            rows={2}
            placeholder={t("eGBookTicketsA")}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      )}
      {mode === "schedule" && (
        <label>
          {t("dayTitle")}
          <select
            ref={first}
            aria-label={t("dayTitle")}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
          >
            {Array.from({ length: days }, (_, index) => (
              <option key={index} value={index + 1}>
                {t("dayV0", { v0: index + 1 })} · {labels[index]}
              </option>
            ))}
          </select>
        </label>
      )}
      {failed && <EditErrors errors={[{ key: "somethingWentWrongTryAgain" }]} />}
      <div className="item-editor__actions">
        <button type="submit" className="primary" disabled={!validDay}>
          {mode === "schedule" ? t("schedule") : t("save")}
        </button>
        <button type="button" onClick={cancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

export function PlaceSearch({
  draftKey = "place-search",
  label,
  locked,
  edits,
  focusOnMount = false,
  phone,
  onUse,
  onCancel,
}: {
  draftKey?: string;
  label: string;
  locked: boolean;
  edits: TimelineEdits;

  focusOnMount?: boolean;
  phone: boolean;
  onUse(placeId: string): boolean | Promise<boolean>;
  onCancel?(): void;
}) {
  const { t } = useLocale();
  const [query, setQuery, resetQuery] = useEditorDraft(`${draftKey}:query`, "");
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
          resetQuery();
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
              placeholder={t("searchGoogleMaps")}
              disabled={locked}
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        <button type="submit" disabled={locked || !query.trim()}>
          {t("search")}
        </button>
      </form>
      <EditErrors errors={edits.errors} />
      {!!edits.results.length && (
        <ul className="stop-editor__results" aria-label={t("placeResults")}>
          {edits.results.map((result) => (
            <li key={result.id}>
              <span>
                <strong>{result.displayName?.text ?? t("unnamedPlace")}</strong>
                <small>{result.formattedAddress ?? t("addressUnavailable")}</small>
              </span>
              <button
                type="button"
                disabled={locked}
                aria-label={t("useV0", { v0: result.displayName?.text ?? "this place" })}
                onClick={() =>
                  void Promise.resolve(onUse(result.id)).then((done) => {
                    if (done) resetQuery();
                  })
                }
              >
                {t("use")}
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
