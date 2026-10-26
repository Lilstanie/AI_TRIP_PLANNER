"use client";
import type { GooglePlace } from "@/lib/integrations/google";
import { useLocale } from "@/components/account/LocaleProvider";
import type { TimelineEdits } from "./useTimelineEdits";

export type AddStopDraft = {
  open: boolean;
  searchText: string;
  place?: GooglePlace;
  name: string;
  detail: string;
  day: number;
  startTime: string;
  endTime: string;
};

export const emptyAddStopDraft = (
  day = 1,
  suggestedTimes?: Pick<AddStopDraft, "startTime" | "endTime">,
): AddStopDraft => ({
  open: false,
  searchText: "",
  name: "",
  detail: "",
  day,
  startTime: suggestedTimes?.startTime ?? "",
  endTime: suggestedTimes?.endTime ?? "",
});

export function AddStop({
  days,
  dayLabels,
  locked = false,
  edits,
  draft,
  onDraftChange,
  suggestedTimesForDay,
  onRequestCancel,
}: {
  days: number;
  dayLabels: string[];
  locked?: boolean;
  edits: TimelineEdits;
  draft: AddStopDraft;
  onDraftChange(draft: AddStopDraft): void;
  suggestedTimesForDay?(day: number): Pick<AddStopDraft, "startTime" | "endTime"> | undefined;
  onRequestCancel(): void;
}) {
  const { t, notice } = useLocale();
  const update = (patch: Partial<AddStopDraft>) => onDraftChange({ ...draft, ...patch });
  const title = (draft.place?.displayName?.text ?? draft.name).trim();

  async function save(asIdea: boolean) {
    if (
      !title ||
      (!asIdea && (!draft.startTime || !draft.endTime || draft.endTime <= draft.startTime))
    )
      return;
    const saved = await edits.add({
      id: crypto.randomUUID(),
      detail: draft.detail.trim() || title,
      location: title,
      ...(draft.place?.location
        ? {
            placeId: draft.place.id,
            savedPlace: {
              name: title,
              address: draft.place.formattedAddress ?? title,
              location: draft.place.location,
            },
          }
        : {}),
      ...(!asIdea ? { day: draft.day, startTime: draft.startTime, endTime: draft.endTime } : {}),
    });
    if (!saved) return;
    edits.clearResults();
    onDraftChange(emptyAddStopDraft(draft.day));
  }

  if (!draft.open)
    return (
      <div className="timeline-add-stop">
        <button
          type="button"
          disabled={locked}
          onClick={() => {
            const suggested = suggestedTimesForDay?.(draft.day);
            update({
              open: true,
              ...(!draft.startTime && suggested ? { startTime: suggested.startTime } : {}),
              ...(!draft.endTime && suggested ? { endTime: suggested.endTime } : {}),
            });
          }}
        >
          {t("Add place")}
        </button>
      </div>
    );

  return (
    <section className="timeline-add-stop stop-editor" aria-label={t("Add place")}>
      <form
        className="stop-editor__group stop-editor__search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.searchText.trim()) void edits.search(draft.searchText.trim());
        }}
      >
        <label>
          {t("Search places")}
          <span className="stop-editor__search-field">
            <input
              type="search"
              aria-label={t("Search places")}
              value={draft.searchText}
              placeholder={t("Search Google Maps")}
              disabled={locked || edits.busy}
              onChange={(event) => update({ searchText: event.target.value })}
            />
          </span>
        </label>
        <button type="submit" disabled={locked || edits.busy || !draft.searchText.trim()}>
          {t("Search")}
        </button>
      </form>
      {edits.errors.length > 0 && (
        <div role="alert" className="stop-editor__errors">
          {edits.errors.map((error, index) => (
            <p key={index}>{notice(error)}</p>
          ))}
        </div>
      )}
      {!!edits.results.length && (
        <ul className="stop-editor__results" aria-label={t("Place results")}>
          {edits.results.map((result) => {
            const name = result.displayName?.text ?? t("Unnamed place");
            return (
              <li key={result.id}>
                <span>
                  <strong>{name}</strong>
                  <small>{result.formattedAddress ?? t("Address unavailable")}</small>
                </span>
                <button
                  type="button"
                  disabled={locked}
                  aria-label={t("Use {v0}", { v0: name })}
                  onClick={() => update({ place: result, name })}
                >
                  {t("Use")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <label>
        {t("Place name")}
        <input
          value={draft.place?.displayName?.text ?? draft.name}
          disabled={locked}
          maxLength={120}
          onChange={(event) => update({ place: undefined, name: event.target.value })}
        />
      </label>
      <label>
        {t("What you will do")}
        <textarea
          value={draft.detail}
          maxLength={500}
          rows={2}
          disabled={locked}
          onChange={(event) => update({ detail: event.target.value })}
        />
      </label>
      <label>
        {t("Day")}
        <select
          value={draft.day}
          disabled={locked}
          onChange={(event) => {
            const day = Number(event.target.value);
            const suggested = suggestedTimesForDay?.(day);
            update({
              day,
              ...(suggested ? suggested : {}),
            });
          }}
        >
          {Array.from({ length: days }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              {t("Day {v0}", { v0: index + 1 })} · {dayLabels[index]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Start time")} <small>{t("Suggested; editable")}</small>
        <input
          type="time"
          value={draft.startTime}
          disabled={locked}
          onChange={(event) => update({ startTime: event.target.value })}
        />
      </label>
      <label>
        {t("End time")} <small>{t("Suggested; editable")}</small>
        <input
          type="time"
          value={draft.endTime}
          disabled={locked}
          onChange={(event) => update({ endTime: event.target.value })}
        />
      </label>
      {draft.startTime && draft.endTime && draft.endTime <= draft.startTime && (
        <p className="stop-editor__hint" role="alert">
          {t("End time must be after start time on the same day.")}
        </p>
      )}
      <div className="item-editor__actions">
        <button
          type="button"
          className="primary"
          disabled={
            locked ||
            edits.busy ||
            !title ||
            !draft.startTime ||
            !draft.endTime ||
            draft.endTime <= draft.startTime
          }
          onClick={() => void save(false)}
        >
          {t("Add stop")}
        </button>
        <button
          type="button"
          disabled={locked || edits.busy || !title}
          onClick={() => void save(true)}
        >
          {t("Save as Idea")}
        </button>
        <button type="button" disabled={edits.busy} onClick={onRequestCancel}>
          {t("Cancel")}
        </button>
      </div>
    </section>
  );
}
