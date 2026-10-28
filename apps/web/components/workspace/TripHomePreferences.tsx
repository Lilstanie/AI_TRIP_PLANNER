"use client";
import { useRef, useState, type FormEvent } from "react";
import type { TripPlan } from "@trip/shared";
import { useLocale } from "../account/LocaleProvider";
import { FactFields } from "../preferences/FactFields";
import { factErrors } from "@/lib/workspace/trip-facts";
import type { Draft } from "@/lib/workspace/workspace";
import type { Notice } from "@/lib/i18n/notice";

export type TripHomePreferencesProps = {
  draft: Draft;
  plan: TripPlan;
  busy: boolean;
  errors: Record<string, Notice>;
  onSave(next: Draft): void;
  onReplan(next: Draft): boolean;
  onDone(): void;
};

export function TripHomePreferences({
  draft,
  plan,
  busy,
  errors,
  onSave,
  onReplan,
  onDone,
}: TripHomePreferencesProps) {
  const { t, currency } = useLocale();
  const [value, setValue] = useState(draft);
  const [localErrors, setLocalErrors] = useState<Record<string, Notice>>();
  const form = useRef<HTMLFormElement>(null);
  const shownErrors = localErrors ?? errors;

  const check = () => {
    const found = factErrors("preferences", value, plan.brief, true, currency);
    setLocalErrors(found);
    if (!Object.keys(found).length) return true;
    requestAnimationFrame(() =>
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
    return false;
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!check()) return;
    onSave(value);
    onDone();
  };

  return (
    <form ref={form} className="fact-form trip-home-preferences" noValidate onSubmit={save}>
      <fieldset disabled={busy} className="plain-fieldset fact-form__fields">
        <FactFields
          fact="preferences"
          value={value}
          onChange={(next) => {
            setValue(next);
            setLocalErrors(undefined);
          }}
          errors={shownErrors}
          suggestPlaces={false}
        />
      </fieldset>
      <div className="fact-form__actions">
        <button type="submit" className="fact-form__secondary" disabled={busy}>
          {t("Save")}
        </button>
        <button
          type="button"
          className="primary fact-form__primary"
          disabled={busy}
          onClick={() => {
            if (check() && onReplan(value)) onDone();
          }}
        >
          {t(busy ? "Planning…" : "Replan trip")}
        </button>
      </div>
    </form>
  );
}
