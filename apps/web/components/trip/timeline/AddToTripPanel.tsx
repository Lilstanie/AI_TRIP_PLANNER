"use client";
import { useMemo, useState } from "react";
import type { TripPlaces } from "../../map/useTripPlaces";
import { useLocale } from "@/components/account/LocaleProvider";
import { ADD_FILTERS, matchesFilter, type AddFilter } from "@/lib/trip/add-filters";
import { readSavedPlaces } from "@/lib/trip/saved-places";
import type { GooglePlace } from "@/lib/integrations/google";
import type { TimelineEdits } from "./useTimelineEdits";

type Activity = TripPlaces["activities"][number];
export type AddTarget = { kind: "day"; day: number } | { kind: "ideas" };
type Tab = "search" | "ideas" | "saved" | "custom";

const FILTER_LABEL = {
  places: "Places",
  stays: "Stays",
  restaurants: "Restaurants",
  experiences: "Experiences",
  events: "Events",
} as const;

const TAB_LABEL = { search: "Search", ideas: "Ideas", saved: "Saved", custom: "Custom" } as const;

function clockPlusHour(start: string) {
  const [hours = 0, minutes = 0] = start.split(":").map(Number);
  const total = Math.min(hours * 60 + minutes + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function AddToTripPanel({
  target,
  tripId,
  locked,
  edits,
  ideas,
  onSchedule,
  onClose,
}: {
  target: AddTarget;
  tripId: string;
  locked: boolean;
  edits: TimelineEdits;
  ideas: Activity[];
  onSchedule(idea: Activity, day: number): boolean | Promise<boolean>;
  onClose(): void;
}) {
  const { t, notice } = useLocale();
  const tabs: Tab[] =
    target.kind === "day" ? ["search", "ideas", "saved", "custom"] : ["search", "saved", "custom"];
  const [tab, setTab] = useState<Tab>("search");
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<AddFilter>("places");
  const [keepOpen, setKeepOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [start, setStart] = useState("");
  const saved = useMemo(() => readSavedPlaces(tripId), [tripId]);
  const disabled = locked || edits.busy;

  const close = () => {
    edits.clearResults();
    onClose();
  };
  const finish = (added: boolean) => {
    if (!added) return;
    if (!keepOpen) return close();
    edits.clearResults();
    setText("");
    setName("");
    setNote("");
    setStart("");
  };
  const day = target.kind === "day" ? { day: target.day } : {};

  async function addPlace(input: {
    title: string;
    placeId?: string;
    address?: string;
    location?: { latitude: number; longitude: number };
  }) {
    finish(
      await edits.add({
        id: crypto.randomUUID(),
        detail: input.title,
        location: input.title,
        ...(input.location
          ? {
              ...(input.placeId ? { placeId: input.placeId } : {}),
              savedPlace: {
                name: input.title,
                address: input.address ?? input.title,
                location: input.location,
              },
            }
          : {}),
        ...day,
      }),
    );
  }

  const search = (value: string, next: AddFilter) => {
    if (value.trim()) void edits.search(value.trim(), next === "places" ? undefined : next);
  };
  const results = edits.results.filter((place: GooglePlace) => matchesFilter(place, filter));
  const typed = name.trim();

  return (
    <section
      className="add-panel"
      aria-label={t("Add to trip")}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    >
      <div className="add-panel__head">
        <div
          className="add-panel__tabs"
          role="tablist"
          onKeyDown={(event) => {
            const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            if (!step) return;
            event.preventDefault();
            const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length]!;
            setTab(next);
            (event.currentTarget.querySelector(`[data-tab="${next}"]`) as HTMLElement)?.focus();
          }}
        >
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              data-tab={id}
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
            >
              {t(TAB_LABEL[id])}
            </button>
          ))}
        </div>
        <button type="button" className="add-panel__close" onClick={close}>
          {t("Close")}
        </button>
      </div>

      {edits.errors.length > 0 && (
        <div role="alert" className="stop-editor__errors">
          {edits.errors.map((error, index) => (
            <p key={index}>{notice(error)}</p>
          ))}
        </div>
      )}

      {tab === "search" && (
        <div role="tabpanel" className="add-panel__body">
          <form
            role="search"
            className="stop-editor__search"
            onSubmit={(event) => {
              event.preventDefault();
              search(text, filter);
            }}
          >
            <input
              type="search"
              aria-label={t("Search places")}
              value={text}
              autoFocus
              placeholder={t("Search Google Maps")}
              disabled={locked}
              onChange={(event) => setText(event.target.value)}
            />
            <button type="submit" disabled={disabled || !text.trim()}>
              {t("Search")}
            </button>
          </form>
          <div className="add-panel__filters" role="group" aria-label={t("Filter results")}>
            {ADD_FILTERS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                disabled={locked}
                onClick={() => {
                  setFilter(id);
                  search(text, id);
                }}
              >
                {t(FILTER_LABEL[id])}
              </button>
            ))}
          </div>
          {!!results.length && (
            <ul className="stop-editor__results" aria-label={t("Place results")}>
              {results.map((place) => {
                const title = place.displayName?.text ?? t("Unnamed place");
                return (
                  <li key={place.id}>
                    <span>
                      <strong>{title}</strong>
                      <small>{place.formattedAddress ?? t("Address unavailable")}</small>
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={t("Add {v0}", { v0: title })}
                      onClick={() =>
                        void addPlace({
                          title,
                          placeId: place.id,
                          ...(place.formattedAddress ? { address: place.formattedAddress } : {}),
                          ...(place.location ? { location: place.location } : {}),
                        })
                      }
                    >
                      {t("Add")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "ideas" && target.kind === "day" && (
        <div role="tabpanel" className="add-panel__body">
          {ideas.length ? (
            <ul className="stop-editor__results" aria-label={t("Ideas")}>
              {ideas.map((idea) => {
                const title = idea.location ?? idea.detail;
                return (
                  <li key={idea.id}>
                    <span>
                      <strong>{title}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={t("Add {v0}", { v0: title })}
                      onClick={async () => finish(await onSchedule(idea, target.day))}
                    >
                      {t("Add")}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="add-panel__empty">{t("No ideas yet.")}</p>
          )}
        </div>
      )}

      {tab === "saved" && (
        <div role="tabpanel" className="add-panel__body">
          {saved.length ? (
            <ul className="stop-editor__results" aria-label={t("Saved places")}>
              {saved.map((place) => (
                <li key={place.key}>
                  <span>
                    <strong>{place.name}</strong>
                    {place.address && <small>{place.address}</small>}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={t("Add {v0}", { v0: place.name })}
                    onClick={() =>
                      void addPlace({
                        title: place.name,
                        ...(place.placeId ? { placeId: place.placeId } : {}),
                        ...(place.address ? { address: place.address } : {}),
                        location: place.location,
                      })
                    }
                  >
                    {t("Add")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="add-panel__empty">{t("Nothing saved yet.")}</p>
          )}
        </div>
      )}

      {tab === "custom" && (
        <form
          role="tabpanel"
          className="add-panel__body add-panel__custom"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!typed) return;
            const timed = target.kind === "day" && start;
            finish(
              await edits.add({
                id: crypto.randomUUID(),
                detail: typed,
                location: typed,
                ...(note.trim() ? { note: note.trim() } : {}),
                ...day,
                ...(timed ? { startTime: start, endTime: clockPlusHour(start) } : {}),
              }),
            );
          }}
        >
          <label>
            {t("Name")}
            <input
              value={name}
              maxLength={120}
              disabled={locked}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {target.kind === "day" && (
            <label>
              {t("Start time")}
              <input
                type="time"
                value={start}
                disabled={locked}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
          )}
          <label>
            {t("Note")}
            <input
              value={note}
              maxLength={500}
              disabled={locked}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button type="submit" className="primary" disabled={disabled || !typed}>
            {t("Add")}
          </button>
        </form>
      )}

      <label className="add-panel__keep">
        <input
          type="checkbox"
          checked={keepOpen}
          onChange={(event) => setKeepOpen(event.target.checked)}
        />
        {t("Keep open")}
      </label>
    </section>
  );
}
