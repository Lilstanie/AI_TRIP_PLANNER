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
import { usePresence } from "../ui/motion";
import { useLocale } from "../account/LocaleProvider";
import { useDiscardChanges } from "../ui/useDiscardChanges";
import type { MessageKey } from "@/lib/i18n/locale";
import type { Notice } from "@/lib/i18n/notice";

const TITLES: Record<FactKey, MessageKey> = {
  where: "Where",
  when: "When",
  who: "Who",
  budget: "Budget",
  preferences: "Trip preferences",
};
const EMPTY: Record<Exclude<FactKey, "preferences">, MessageKey> = {
  where: "Where",
  when: "When",
  who: "Who",
  budget: "Budget",
};

const NAMES: Record<Exclude<FactKey, "preferences">, MessageKey> = {
  where: "Destination",
  when: "Dates",
  who: "Travellers",
  budget: "Budget",
};

type Props = {
  draft: Draft;
  plan: TripPlan | undefined;
  busy: boolean;

  errors: Record<string, Notice>;
  open: FactKey | undefined;
  onOpen(fact: FactKey): void;
  onClose(): void;

  onSave(next: Draft): void;

  onPlan(next: Draft): boolean;

  preferencesChip: RefObject<HTMLButtonElement | null>;

  suggestPlaces?: boolean;
  phone?: boolean;
  view?: string;
};

export function TripFactChips(props: Props) {
  const { draft, plan, open, onOpen, onClose, preferencesChip, phone, view } = props;
  const [origin, setOrigin] = useState({ open, view });
  if (origin.open !== open) setOrigin({ open, view });
  const { locale, t, currency } = useLocale();
  const labels = factLabels(draft, plan?.brief, {
    locale,
    currency,
  });

  const shown = usePresence(open, 220);
  const [dirty, setDirty] = useState(false);
  const { requestClose, confirmation } = useDiscardChanges(!!phone && dirty);
  const chips = useRef<Partial<Record<FactKey, HTMLButtonElement | null>>>({});

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

  useEffect(() => {
    if (open) chips.current[open]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [open]);

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
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const max = row.scrollWidth - row.clientWidth;
      if (max <= 1) return;
      const delta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      const next = Math.min(max, Math.max(0, row.scrollLeft + delta));
      if (next === row.scrollLeft) return;
      event.preventDefault();
      row.scrollLeft = next;
    };
    update();
    row.addEventListener("scroll", update, { passive: true });
    row.addEventListener("wheel", onWheel, { passive: false });
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      row.removeEventListener("wheel", onWheel);
      observer.disconnect();
    };
  }, []);

  const labelText = Object.values(labels).join("|");
  useEffect(() => {
    scroller.current?.dispatchEvent(new Event("scroll"));
  }, [labelText]);

  return (
    <div className="fact-chips" role="group" aria-label={t("Trip details")}>
      <div ref={scroller} className="fact-chips__scroller">
        {FACTS.map((fact) => {
          const expanded = open === fact;
          const common = {
            type: "button" as const,
            "aria-haspopup": "dialog" as const,
            "aria-expanded": expanded,
            "aria-controls": expanded ? `fact-popover-${fact}` : undefined,
            onClick: () => requestClose(() => (expanded ? close("dismiss") : onOpen(fact))),
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
                aria-label={t("Open trip preferences")}
              >
                <SlidersIcon />
                <span>{t("Preferences")}</span>
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
              title={label || undefined}
              data-empty={label ? undefined : "true"}
            >
              {label ? (
                <>
                  <span className="sr-only">
                    {t(NAMES[fact])}
                    {locale === "zh" ? "：" : ": "}
                  </span>
                  <span className="fact-chip__value">{label}</span>
                </>
              ) : (
                t(EMPTY[fact])
              )}
            </button>
          );
        })}
      </div>
      {shown.value && (
        <FactPopover
          key={shown.leaving ? `${shown.value}:leaving` : shown.value}
          id={`fact-popover-${shown.value}`}
          title={t(TITLES[shown.value])}
          anchor={anchor}
          onClose={(reason) => requestClose(() => close(reason))}
          modal
          hidden={origin.view !== view}
          leaving={shown.leaving}
          className={`fact-popover--${shown.value}`}
        >
          <FactForm
            {...props}
            fact={shown.value}
            onDirtyChange={setDirty}
            onDone={() => close("dismiss")}
          />
        </FactPopover>
      )}
      {confirmation}
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
  onDirtyChange,
  suggestPlaces = false,
}: Props & { fact: FactKey; onDone(): void; onDirtyChange(dirty: boolean): void }) {
  const { t, currency } = useLocale();
  const [value, setValue] = useState(draft);
  const initial = useRef(draft);
  useEffect(() => {
    onDirtyChange(JSON.stringify(initial.current) !== JSON.stringify(value));
    return () => onDirtyChange(false);
  }, [value, onDirtyChange]);
  const [local, setLocal] = useState<Record<string, Notice>>();
  const form = useRef<HTMLFormElement>(null);

  const shown =
    local ??
    Object.fromEntries(Object.entries(errors).filter(([key]) => factForError(key) === fact));

  const check = () => {
    const found = factErrors(fact, value, plan?.brief ?? { tripId: "draft" }, !!plan, currency);
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
            {t(busy ? "Planning…" : "Plan trip")}
          </button>
        )}
        <button type="submit" className="primary fact-form__primary" disabled={busy}>
          {t(
            plan ? (busy ? "Planning…" : "Replan trip") : fact === "preferences" ? "Done" : "Save",
          )}
        </button>
      </div>
    </form>
  );
}
