"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MAX_TRIP_PREFERENCE_LENGTH, MAX_TRIP_PREFERENCES } from "@trip/shared";
import { draftPreferences, type Draft } from "@/lib/workspace";
import { CloseIcon } from "../ui/icons";
import { Input } from "../ui/input";

type Props = {
  value: Draft;
  onChange(next: Draft): void;
  errors: Record<string, string>;
};

const clean = (text: string) => text.trim().replace(/\s+/g, " ");
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Trip preferences: the traveller's own requests, one per row, that every specialist weighs. A
 * row is added from the field at the top, edited by clicking its text and removed from its row. Text still
 * in the add field counts, so Save keeps a preference the traveller typed but did not add.
 */
export function PreferenceList({ value, onChange, errors }: Props) {
  const [items, setItems] = useState(() => draftPreferences(value));
  const [pending, setPending] = useState("");
  const [editing, setEditing] = useState<{ index: number; text: string }>();
  const [notice, setNotice] = useState("");
  // A duplicate is refused where the traveller can see why, next to the field.
  const [problem, setProblem] = useState("");
  const addInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [focusNext, setFocusNext] = useState<"add" | { row: number; part: "edit" | "field" }>();

  const full = items.length >= MAX_TRIP_PREFERENCES;

  const publish = (
    nextItems: string[],
    nextPending: string,
    nextEditing: typeof editing = editing,
  ) => {
    const merged = nextItems.map((item, index) =>
      nextEditing?.index === index ? clean(nextEditing.text) : item,
    );
    const extra = clean(nextPending);
    onChange({
      ...value,
      preferences: [
        ...merged.filter(Boolean),
        ...(extra && !merged.some((item) => same(item, extra)) ? [extra] : []),
      ],
    });
  };

  useEffect(() => {
    if (!focusNext) return;
    if (focusNext === "add") addInput.current?.focus();
    else {
      const rows = list.current?.querySelectorAll<HTMLElement>(".pref-row");
      const row = rows?.[Math.min(focusNext.row, (rows?.length ?? 1) - 1)];
      const target =
        focusNext.part === "field"
          ? row?.querySelector<HTMLElement>("input")
          : row?.querySelector<HTMLElement>(".pref-row__edit");
      (target ?? addInput.current)?.focus();
    }
    setFocusNext(undefined);
  }, [focusNext]);

  const add = () => {
    const text = clean(pending);
    if (!text) return;
    if (items.some((item) => same(item, text))) {
      setProblem("That preference is already on the list.");
      return;
    }
    const next = [...items, text];
    setItems(next);
    setPending("");
    setNotice(`Added “${text}”.`);
    publish(next, "");
  };
  const remove = (index: number) => {
    const removed = items[index];
    const next = items.filter((_, at) => at !== index);
    setItems(next);
    setEditing(undefined);
    setNotice(`Removed “${removed}”.`);
    publish(next, pending, undefined);
    setFocusNext(next.length ? { row: index, part: "edit" } : "add");
  };
  const startEdit = (index: number) => {
    setEditing({ index, text: items[index]! });
    setFocusNext({ row: index, part: "field" });
  };
  /** `refocus` is false when focus has already moved elsewhere (the field lost it). */
  const finishEdit = (keep: boolean, refocus = true) => {
    if (!editing) return;
    const { index } = editing;
    const text = clean(editing.text);
    const duplicate = items.some((item, at) => at !== index && same(item, text));
    if (keep && !text) return remove(index);
    const next = keep && !duplicate ? items.map((item, at) => (at === index ? text : item)) : items;
    setProblem(keep && duplicate ? "That preference is already on the list." : "");
    setItems(next);
    setEditing(undefined);
    publish(next, pending, undefined);
    if (refocus) setFocusNext({ row: index, part: "edit" });
  };
  const onEditKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishEdit(true);
    } else if (event.key === "Escape") {
      // Cancels this row's edit only; the dialog ignores a prevented Escape.
      event.preventDefault();
      finishEdit(false);
    }
  };

  const error = errors.preferences || problem;
  return (
    <section className="fact-section" aria-label="Your preferences">
      <label className="sr-only" htmlFor="fact-preference">
        Add a preference
      </label>
      <Input
        ref={addInput}
        id="fact-preference"
        className="field pref-input"
        value={pending}
        maxLength={MAX_TRIP_PREFERENCE_LENGTH}
        disabled={full}
        data-autofocus=""
        enterKeyHint="enter"
        placeholder={full ? "The list is full" : "Add a trip preference…"}
        aria-invalid={!!error || undefined}
        aria-describedby={
          error ? "fact-preference-error" : full ? "fact-preference-hint" : undefined
        }
        onChange={(event) => {
          setPending(event.target.value);
          setNotice("");
          setProblem("");
          publish(items, event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          add();
        }}
      />
      {error ? (
        <small className="error-text fact-form__error" id="fact-preference-error">
          {error}
        </small>
      ) : (
        full && (
          <small className="muted form-field__hint" id="fact-preference-hint">
            {`You have ${MAX_TRIP_PREFERENCES} preferences, the most a trip keeps. Remove one to add another.`}
          </small>
        )
      )}
      {items.length > 0 && (
        <ul ref={list} className="pref-list" aria-label="Your preferences">
          {items.map((item, index) =>
            editing?.index === index ? (
              <li key={index} className="pref-row pref-row--editing">
                <Input
                  className="field pref-row__field"
                  value={editing.text}
                  maxLength={MAX_TRIP_PREFERENCE_LENGTH}
                  aria-label={`Edit preference ${index + 1}`}
                  onChange={(event) => {
                    const next = { index, text: event.target.value };
                    setEditing(next);
                    publish(items, pending, next);
                  }}
                  onKeyDown={onEditKey}
                  onBlur={() => finishEdit(true, false)}
                />
              </li>
            ) : (
              <li key={index} className="pref-row">
                {/* The text itself is the edit control, so the row stays as plain as the list. */}
                <button
                  type="button"
                  className="pref-row__text pref-row__edit"
                  aria-label={`Edit “${item}”`}
                  disabled={!!editing}
                  onClick={() => startEdit(index)}
                >
                  {item}
                </button>
                <button
                  type="button"
                  className="pref-row__remove"
                  aria-label={`Remove “${item}”`}
                  onClick={() => remove(index)}
                >
                  <CloseIcon />
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      <p className="sr-only" role="status">
        {notice}
      </p>
    </section>
  );
}
