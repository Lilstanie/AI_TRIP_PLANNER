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
};

export function TripFactChips(props: Props) {
  const { draft, plan, open, onOpen, onClose, preferencesChip } = props;
  const { locale, t, currency } = useLocale();
  const labels = factLabels(draft, plan?.brief, {
    locale,
    currency,
  });

  const shown = usePresence(open, 220);
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
    update();
    row.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : undefined;
    observer?.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      observer?.disconnect();
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
              data-empty={label ? undefined : "true"}
            >
              {label ? (
                <>
                  <span className="sr-only">
                    {t(NAMES[fact])}
                    {locale === "zh" ? "：" : ": "}
                  </span>
                  {label}
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
          onClose={close}
          modal
          leaving={shown.leaving}
          className={`fact-popover--${shown.value}`}
        >
          <FactForm {...props} fact={shown.value} onDone={() => close("dismiss")} />
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
  const { t } = useLocale();
  const [value, setValue] = useState(draft);
  const [local, setLocal] = useState<Record<string, Notice>>();
  const form = useRef<HTMLFormElement>(null);

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
            {t(busy ? "Planning…" : "Plan trip")}
          </button>
        )}
        <button type="submit" className="primary fact-form__primary" disabled={busy}>
          {t(
            plan ? (busy ? "Planning…" : "Update trip") : fact === "preferences" ? "Done" : "Save",
          )}
        </button>
      </div>
    </form>
  );
}
