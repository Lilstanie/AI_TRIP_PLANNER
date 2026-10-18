"use client";
import { useEffect, useRef, useState } from "react";
import type { Draft } from "@/lib/workspace";
import { destinationCities } from "@/lib/map/place-query";
import { CloseIcon, MapPinIcon, PlusIcon } from "../ui/icons";
import { PlaceInput } from "./PlaceInput";
import { useLocale } from "../account/LocaleProvider";
import type { Notice } from "@/lib/i18n/notice";

type Props = {
  value: Draft;
  onChange(next: Draft): void;
  errors: Record<string, Notice>;

  suggestPlaces: boolean;
};

const places = (text: string) =>
  text
    .split("&")
    .map((place) => place.trim())
    .filter(Boolean);

function withPlaces(list: string[], added: string[]) {
  const next = [...list];
  for (const place of added)
    if (!next.some((item) => item.toLowerCase() === place.toLowerCase())) next.push(place);
  return next;
}

export function WhereFields({ value, onChange, errors, suggestPlaces }: Props) {
  const { t, notice: localizeNotice } = useLocale();
  const [stops, setStops] = useState(() => destinationCities(value.destination));

  const [regions, setRegions] = useState<Record<string, string>>({});
  const [pending, setPending] = useState("");
  const [adding, setAdding] = useState(stops.length === 0);
  const addInput = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLOListElement>(null);

  const [focusNext, setFocusNext] = useState<"input" | "button" | number>();

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
          <ol ref={list} className="stop-list" aria-label={t("Destinations")}>
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
                  aria-label={t("Remove {v0}", { v0: stop })}
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
            label={t("Add a destination")}
            value={pending}
            inputRef={addInput}
            autoFocus
            suggest={suggestPlaces}
            placeholder={t("City or region")}
            invalid={!!error}
            describedBy={error ? "fact-destination-error" : undefined}
            onChange={(text) => {
              setPending(text);
              publish(stops, text);
            }}
            onPick={add}
            onEnter={() => pending.trim() && add(pending)}
            onEscape={() => {
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
            {t("Add destination")}
          </button>
        )}
        {error && (
          <small className="error-text fact-form__error" id="fact-destination-error">
            {localizeNotice(error)}
          </small>
        )}
      </div>
      <section className="fact-section fact-section--secondary">
        <label className="fact-section__label" htmlFor="fact-origin">
          {t("Departing from")} <span className="fact-section__optional">{t("(optional)")}</span>
        </label>
        <PlaceInput
          id="fact-origin"
          value={value.origin}
          suggest={suggestPlaces}
          placeholder={t("Your home city")}
          invalid={!!errors.origin}
          describedBy={errors.origin ? "fact-origin-error" : "fact-origin-hint"}
          onChange={(origin) => onChange({ ...value, origin })}
          onPick={(origin) => onChange({ ...value, origin })}
        />
        {errors.origin ? (
          <small className="error-text fact-form__error" id="fact-origin-error">
            {localizeNotice(errors.origin)}
          </small>
        ) : (
          <small className="muted form-field__hint" id="fact-origin-hint">
            {t("Leave blank to plan the destination only, without long-haul flights.")}
          </small>
        )}
      </section>
    </>
  );
}
