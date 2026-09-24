"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { CloseIcon, MapPinIcon } from "../ui/icons";
import { Input } from "../ui/input";

/** Characters typed before a lookup is worth its cost. */
export const SUGGEST_MIN_CHARS = 3;
/** Quiet time after the last keystroke before a lookup is sent. */
export const SUGGEST_DEBOUNCE_MS = 350;

export type PlaceSuggestion = { id: string; name: string; address?: string };

/**
 * Places matching what is typed, from `/api/places/search`. Every lookup is billed, so it runs
 * only when `enabled` (live data with Maps configured), after SUGGEST_MIN_CHARS characters and
 * SUGGEST_DEBOUNCE_MS of quiet, and each query is asked at most once per editor. A failed lookup
 * shows nothing: typing the name by hand always works.
 */
export function usePlaceSuggestions(query: string, enabled: boolean) {
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const cache = useRef(new Map<string, PlaceSuggestion[]>());
  const text = query.trim();
  const active = enabled && text.length >= SUGGEST_MIN_CHARS;

  useEffect(() => {
    if (!active) {
      setResults([]);
      return;
    }
    const key = text.toLowerCase();
    const cached = cache.current.get(key);
    if (cached) {
      setResults(cached);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/places/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("lookup failed");
        const body = (await response.json()) as {
          places?: { id?: string; displayName?: { text?: string }; formattedAddress?: string }[];
        };
        const found = (body.places ?? []).flatMap((place) =>
          place.id && place.displayName?.text
            ? [{ id: place.id, name: place.displayName.text, address: place.formattedAddress }]
            : [],
        );
        cache.current.set(key, found);
        if (!controller.signal.aborted) setResults(found);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [active, text]);

  return active ? results : [];
}

/** The name with the part that matches what was typed in bold, as a suggestion shows it. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <strong>{text.slice(at, at + query.length)}</strong>
      {text.slice(at + query.length)}
    </>
  );
}

/**
 * A pill-shaped text field for a place name, with a clear button inside while it holds text. With suggestions on it is a combobox: arrow keys move through
 * the matches, Enter picks one, and Escape closes the list without closing the editor. Without
 * them it is a plain field, and Enter hands the typed text to `onEnter`.
 */
export function PlaceInput({
  id,
  value,
  onChange,
  onPick,
  onEnter,
  onEscape,
  suggest,
  placeholder,
  describedBy,
  invalid,
  label,
  inputRef,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange(value: string): void;
  /** A suggestion was chosen; `address` is the region line it came with, if any. */
  onPick(name: string, address?: string): void;
  /** Enter with no suggestion highlighted. */
  onEnter?(): void;
  /** Escape with no suggestion list open; return true when it was handled. */
  onEscape?(): boolean;
  suggest: boolean;
  placeholder?: string;
  describedBy?: string;
  invalid?: boolean;
  /** Accessible name when there is no visible `<label>`. */
  label?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const ownRef = useRef<HTMLInputElement>(null);
  const field = inputRef ?? ownRef;
  const suggestions = usePlaceSuggestions(value, suggest);
  const [highlight, setHighlight] = useState(-1);
  const [dismissed, setDismissed] = useState("");
  const open = suggestions.length > 0 && dismissed !== value;

  useEffect(() => setHighlight(-1), [suggestions]);

  const pick = (item: PlaceSuggestion) => {
    setDismissed(item.name);
    onPick(item.name, item.address);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      setHighlight((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setHighlight((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = open ? suggestions[highlight] : undefined;
      if (chosen) pick(chosen);
      else onEnter?.();
    } else if (event.key === "Escape") {
      // Handled here, the editor stays open: the dialog ignores a prevented Escape.
      if (open) {
        event.preventDefault();
        setDismissed(value);
      } else if (onEscape?.()) event.preventDefault();
    }
  };

  return (
    <div className="place-input">
      <Input
        ref={field}
        id={id}
        className="field"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        data-autofocus={autoFocus ? "" : undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        {...(suggest
          ? {
              role: "combobox",
              "aria-autocomplete": "list" as const,
              "aria-expanded": open,
              "aria-controls": listId,
              "aria-activedescendant":
                open && highlight >= 0 ? `${listId}-${highlight}` : undefined,
            }
          : {})}
      />
      {value && (
        <button
          type="button"
          className="place-input__clear"
          aria-label="Clear"
          // Keep focus in the field.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange("");
            field.current?.focus();
          }}
        >
          <CloseIcon />
        </button>
      )}
      {suggest && (
        <ul id={listId} role="listbox" className="place-input__list" hidden={!open}>
          {open &&
            suggestions.map((item, index) => (
              <li
                key={item.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlight}
                className="place-input__option"
                // Keep focus in the field; the click picks.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(item)}
              >
                <span className="place-input__thumb" aria-hidden="true">
                  <MapPinIcon />
                </span>
                <span className="place-input__text">
                  <span className="place-input__name">
                    <Highlighted text={item.name} query={value.trim()} />
                  </span>
                  {item.address && <span className="place-input__address">{item.address}</span>}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
