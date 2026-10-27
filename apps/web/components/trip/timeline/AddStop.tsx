"use client";
import { useState } from "react";
import type { GooglePlace } from "@/lib/integrations/google";
import { useLocale } from "@/components/account/LocaleProvider";
import type { TimelineEdits } from "./useTimelineEdits";

export function AddStop({
  day,
  locked = false,
  edits,
}: {
  day: number;
  locked?: boolean;
  edits: TimelineEdits;
}) {
  const { t, notice } = useLocale();
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [name, setName] = useState("");

  const close = () => {
    setOpen(false);
    setSearchText("");
    setName("");
    edits.clearResults();
  };

  async function save(title: string, place: GooglePlace | undefined, asIdea: boolean) {
    const saved = await edits.add({
      id: crypto.randomUUID(),
      detail: title,
      location: title,
      ...(place?.location
        ? {
            placeId: place.id,
            savedPlace: {
              name: title,
              address: place.formattedAddress ?? title,
              location: place.location,
            },
          }
        : {}),
      ...(!asIdea ? { day } : {}),
    });
    if (saved) close();
  }

  if (!open)
    return (
      <div className="timeline-add-stop">
        <button type="button" disabled={locked} onClick={() => setOpen(true)}>
          {t("Add place")}
        </button>
      </div>
    );

  const typed = name.trim();
  return (
    <section
      className="timeline-add-stop stop-editor"
      aria-label={t("Add place")}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    >
      <form
        className="stop-editor__group stop-editor__search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (searchText.trim()) void edits.search(searchText.trim());
        }}
      >
        <label>
          {t("Search places")}
          <span className="stop-editor__search-field">
            <input
              type="search"
              aria-label={t("Search places")}
              value={searchText}
              autoFocus
              placeholder={t("Search Google Maps")}
              disabled={locked || edits.busy}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </span>
        </label>
        <button type="submit" disabled={locked || edits.busy || !searchText.trim()}>
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
            const title = result.displayName?.text ?? t("Unnamed place");
            return (
              <li key={result.id}>
                <span>
                  <strong>{title}</strong>
                  <small>{result.formattedAddress ?? t("Address unavailable")}</small>
                </span>
                <button
                  type="button"
                  disabled={locked || edits.busy}
                  aria-label={t("Use {v0}", { v0: title })}
                  onClick={() => void save(title, result, false)}
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
          value={name}
          disabled={locked}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="item-editor__actions">
        <button
          type="button"
          className="primary"
          disabled={locked || edits.busy || !typed}
          onClick={() => void save(typed, undefined, false)}
        >
          {t("Add")}
        </button>
        <button
          type="button"
          disabled={locked || edits.busy || !typed}
          onClick={() => void save(typed, undefined, true)}
        >
          {t("Save as Idea")}
        </button>
        <button type="button" disabled={edits.busy} onClick={close}>
          {t("Cancel")}
        </button>
      </div>
    </section>
  );
}
