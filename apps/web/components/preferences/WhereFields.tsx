"use client";
import { useEffect, useRef, useState } from "react";
import type { Draft } from "@/lib/workspace";
import { destinationCities } from "@/lib/map/place-query";
import { CloseIcon, MapPinIcon, PlusIcon } from "../ui/icons";
import { PlaceInput } from "./PlaceInput";

type Props = {
  value: Draft;
  onChange(next: Draft): void;
  errors: Record<string, string>;
  /** Offer place suggestions while typing (live data with Maps configured). */
  suggestPlaces: boolean;
};

/** Split what was typed into places: "Sydney & Melbourne" is two. */
const places = (text: string) =>
  text
    .split("&")
    .map((place) => place.trim())
    .filter(Boolean);

/** Append places, skipping any already in the list (case-insensitively). */
function withPlaces(list: string[], added: string[]) {
  const next = [...list];
  for (const place of added)
    if (!next.some((item) => item.toLowerCase() === place.toLowerCase())) next.push(place);
  return next;
}

/**
 * Where: the trip's destinations as cards, an Add destination pill that turns into a search field,
 * and where the trip departs from as a quieter field below. The brief keeps the destinations as
 * one string joined with " & ", in list order, which is also the order the trip visits them.
 */
export function WhereFields({ value, onChange, errors, suggestPlaces }: Props) {
  const [stops, setStops] = useState(() => destinationCities(value.destination));
  // The region line of a place picked from a suggestion. Kept for this editor only: the brief
  // stores names, and a typed place has no region to show.
  const [regions, setRegions] = useState<Record<string, string>>({});
  const [pending, setPending] = useState("");
  const [adding, setAdding] = useState(stops.length === 0);
  const addInput = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLOListElement>(null);
  // Where focus goes once React has re-rendered after an add or a removal.
  const [focusNext, setFocusNext] = useState<"input" | "button" | number>();

  // Text still in the search field counts, so Save keeps a place the traveller typed but did not
  // press Enter on.
  const publish = (nextStops: string[], nextPending: string) =>
    onChange({ ...value, destination: withPlaces(nextStops, places(nextPending)).join(" & ") });

  useEffect(() => {
    if (focusNext === undefined) return;
    if (focusNext === "input") addInput.current?.focus();
    else if (focusNext === "button") addButton.current?.focus();
    else {
      const removes = list.current?.querySelectorAll<HTMLButtonElement>(".stop-card__remove");
      const target = removes?.[Math.min(focusNext, removes.length - 1)];
      (target ?? addButton.current ?? addInput.current)?.focus();
    }
    setFocusNext(undefined);
  }, [focusNext]);

  const add = (text: string, address?: string) => {
    const added = places(text);
    const next = withPlaces(stops, added);
    if (address && added.length === 1) setRegions((known) => ({ ...known, [added[0]!]: address }));
    setStops(next);
    setPending("");
    publish(next, "");
    setFocusNext("input");
  };
  const remove = (index: number) => {
    const next = stops.filter((_, at) => at !== index);
    setStops(next);
    publish(next, pending);
    if (next.length === 0) {
      setAdding(true);
      setFocusNext("input");
    } else setFocusNext(index);
  };

  const error = errors.destination;
  return (
    <>
      <div className="fact-section">
        {stops.length > 0 && (
          <ol ref={list} className="stop-list" aria-label="Destinations">
            {stops.map((stop, index) => (
              <li key={stop} className="stop-card">
                <span className="stop-card__thumb" aria-hidden="true">
                  <MapPinIcon />
                </span>
                <span className="stop-card__text">
                  <span className="stop-card__name">{stop}</span>
                  {regions[stop] && (
                    <span className="stop-card__region">
                      <MapPinIcon />
                      {regions[stop]}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="stop-card__remove"
                  aria-label={`Remove ${stop}`}
                  onClick={() => remove(index)}
                >
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ol>
        )}
        {adding ? (
          <PlaceInput
            id="fact-destination"
            label="Add a destination"
            value={pending}
            inputRef={addInput}
            autoFocus
            suggest={suggestPlaces}
            placeholder="City or region"
            invalid={!!error}
            describedBy={error ? "fact-destination-error" : undefined}
            onChange={(text) => {
              setPending(text);
              publish(stops, text);
            }}
            onPick={add}
            onEnter={() => pending.trim() && add(pending)}
            onEscape={() => {
              // With places listed, Escape folds the field back into its pill, dropping what was
              // typed; with none, it closes the editor.
              if (stops.length === 0) return false;
              setPending("");
              publish(stops, "");
              setAdding(false);
              setFocusNext("button");
              return true;
            }}
          />
        ) : (
          <button
            ref={addButton}
            type="button"
            className="stop-add"
            data-autofocus=""
            onClick={() => {
              setAdding(true);
              setFocusNext("input");
            }}
          >
            <PlusIcon />
            Add destination
          </button>
        )}
        {error && (
          <small className="error-text fact-form__error" id="fact-destination-error">
            {error}
          </small>
        )}
      </div>
      <section className="fact-section fact-section--secondary">
        <label className="fact-section__label" htmlFor="fact-origin">
          Departing from <span className="fact-section__optional">(optional)</span>
        </label>
        <PlaceInput
          id="fact-origin"
          value={value.origin}
          suggest={suggestPlaces}
          placeholder="Your home city"
          invalid={!!errors.origin}
          describedBy={errors.origin ? "fact-origin-error" : "fact-origin-hint"}
          onChange={(origin) => onChange({ ...value, origin })}
          onPick={(origin) => onChange({ ...value, origin })}
        />
        {errors.origin ? (
          <small className="error-text fact-form__error" id="fact-origin-error">
            {errors.origin}
          </small>
        ) : (
          <small className="muted form-field__hint" id="fact-origin-hint">
            Leave blank to plan the destination only, without long-haul flights.
          </small>
        )}
      </section>
    </>
  );
}
