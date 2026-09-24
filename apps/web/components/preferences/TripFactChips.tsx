"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import type { TripPlan } from "@trip/shared";
import type { Draft } from "@/lib/workspace";
import {
  FACTS,
  factErrors,
  factLabels,
  factForError,
  type FactKey,
} from "@/lib/workspace/trip-facts";
import { SlidersIcon } from "../ui/icons";
import { FactFields } from "./FactFields";
import { FactPopover, type CloseReason } from "./FactPopover";

const TITLES: Record<FactKey, string> = {
  where: "Where",
  when: "When",
  who: "Who",
  budget: "Budget",
  preferences: "Trip preferences",
};
const EMPTY: Record<Exclude<FactKey, "preferences">, string> = {
  where: "Where",
  when: "When",
  who: "Who",
  budget: "Budget",
};
/** Spoken before a filled chip's value, so "Sydney" is announced as "Destination: Sydney". */
const NAMES: Record<Exclude<FactKey, "preferences">, string> = {
  where: "Destination",
  when: "Dates",
  who: "Travellers",
  budget: "Budget",
};

type Props = {
  draft: Draft;
  plan: TripPlan | undefined;
  busy: boolean;
  /** Errors from the last rejected submission, keyed like `parseDraft`'s issues. */
  errors: Record<string, string>;
  open: FactKey | undefined;
  onOpen(fact: FactKey): void;
  onClose(): void;
  /** Keeps the edit in the draft; before a plan exists it travels with the next chat message. */
  onSave(next: Draft): void;
  /** Keeps the edit and plans with the whole brief. False when the brief was rejected. */
  onPlan(next: Draft): boolean;
  /** The Preferences chip, which other surfaces return focus to. */
  preferencesChip: RefObject<HTMLButtonElement | null>;
  /**
   * Suggest places while typing in Where. Each lookup is a billed Places request, so only in live
   * data mode with Maps configured.
   */
  suggestPlaces?: boolean;
};

/**
 * The trip's key facts as chips in the top bar. Each chip opens a small editor for just its own
 * fields; Preferences holds the rest. Edits stay local to the editor until Save or Update trip, so
 * Escape or a click outside leaves the trip exactly as it was.
 */
export function TripFactChips(props: Props) {
  const { draft, plan, open, onOpen, onClose, preferencesChip } = props;
  const labels = factLabels(draft, plan?.brief);
  const chips = useRef<Partial<Record<FactKey, HTMLButtonElement | null>>>({});
  // Read at event time, after the chip refs have been attached.
  const anchor = useMemo(
    () => ({
      get current() {
        return open ? (chips.current[open] ?? null) : null;
      },
    }),
    [open],
  );

  const close = (reason: CloseReason) => {
    const chip = open ? chips.current[open] : undefined;
    onClose();
    if (reason === "dismiss") chip?.focus({ preventScroll: true });
  };

  // Keep the open chip visible in a scrolled chip row (narrow screens).
  useEffect(() => {
    if (open) chips.current[open]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [open]);

  // When the row is wider than its space it scrolls; fade the edge that has more chips behind it.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = scroller.current;
    if (!row) return;
    const update = () => {
      const start = row.scrollLeft > 1;
      const end = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
      const fade = start && end ? "both" : start ? "start" : end ? "end" : "";
      if (fade) row.dataset.fade = fade;
      else delete row.dataset.fade;
    };
    update();
    row.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : undefined;
    observer?.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, []);
  // A longer label can overflow a row whose own size did not change.
  const labelText = Object.values(labels).join("|");
  useEffect(() => {
    scroller.current?.dispatchEvent(new Event("scroll"));
  }, [labelText]);

  return (
    <div className="fact-chips" role="group" aria-label="Trip details">
      <div ref={scroller} className="fact-chips__scroller">
        {FACTS.map((fact) => {
          const expanded = open === fact;
          const common = {
            type: "button" as const,
            "aria-haspopup": "dialog" as const,
            "aria-expanded": expanded,
            "aria-controls": expanded ? `fact-popover-${fact}` : undefined,
            onClick: () => (expanded ? onClose() : onOpen(fact)),
          };
          if (fact === "preferences")
            return (
              <button
                key={fact}
                {...common}
                ref={(node) => {
                  chips.current[fact] = node;
                  preferencesChip.current = node;
                }}
                className="fact-chip fact-chip--preferences"
                aria-label="Open trip preferences"
              >
                <SlidersIcon />
                <span>Preferences</span>
              </button>
            );
          const label = labels[fact];
          return (
            <button
              key={fact}
              {...common}
              ref={(node) => {
                chips.current[fact] = node;
              }}
              className="fact-chip"
              data-empty={label ? undefined : "true"}
            >
              {label ? (
                <>
                  <span className="sr-only">{NAMES[fact]}: </span>
                  {label}
                </>
              ) : (
                EMPTY[fact]
              )}
            </button>
          );
        })}
      </div>
      {open && (
        <FactPopover
          key={open}
          id={`fact-popover-${open}`}
          title={TITLES[open]}
          anchor={anchor}
          onClose={close}
          modal
          className={`fact-popover--${open}`}
        >
          <FactForm {...props} fact={open} onDone={() => close("dismiss")} />
        </FactPopover>
      )}
    </div>
  );
}

function FactForm({
  fact,
  draft,
  plan,
  busy,
  errors,
  onSave,
  onPlan,
  onDone,
  suggestPlaces = false,
}: Props & { fact: FactKey; onDone(): void }) {
  const [value, setValue] = useState(draft);
  const [local, setLocal] = useState<Record<string, string>>();
  const form = useRef<HTMLFormElement>(null);
  // A rejected submission's errors show until this editor checks its own fields again.
  const shown =
    local ??
    Object.fromEntries(Object.entries(errors).filter(([key]) => factForError(key) === fact));

  const check = () => {
    const found = factErrors(fact, value, plan?.brief ?? { tripId: "draft" }, !!plan);
    setLocal(found);
    if (Object.keys(found).length === 0) return true;
    requestAnimationFrame(() =>
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
    return false;
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!check()) return;
    if (!plan) {
      onSave(value);
      onDone();
    } else if (onPlan(value)) onDone();
  };

  return (
    <form ref={form} className="fact-form" noValidate onSubmit={submit}>
      <fieldset disabled={busy} className="plain-fieldset fact-form__fields">
        <FactFields
          fact={fact}
          value={value}
          onChange={setValue}
          errors={shown}
          suggestPlaces={suggestPlaces}
        />
      </fieldset>
      <div className="fact-form__actions">
        {!plan && fact === "preferences" && (
          <button
            type="button"
            className="fact-form__secondary"
            disabled={busy}
            onClick={() => {
              if (check() && onPlan(value)) onDone();
            }}
          >
            {busy ? "Planning…" : "Plan trip"}
          </button>
        )}
        <button type="submit" className="primary fact-form__primary" disabled={busy}>
          {plan ? (busy ? "Planning…" : "Update trip") : fact === "preferences" ? "Done" : "Save"}
        </button>
      </div>
    </form>
  );
}
