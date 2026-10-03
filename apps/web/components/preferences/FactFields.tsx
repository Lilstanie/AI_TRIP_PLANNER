"use client";
import dynamic from "next/dynamic";
import type { DateRange } from "react-day-picker";
import type { ReactNode } from "react";
import { groupSizeFromParty, partyFor, type Draft, type Party } from "@/lib/workspace";
import { toIsoDate } from "@/lib/planning/date-range";
import { datesLabel, PARTY_ROWS, type FactKey } from "@/lib/workspace/trip-facts";
import { MinusIcon, PlusIcon } from "../ui/icons";
import { Input } from "../ui/input";
import { PreferenceList } from "./PreferenceList";
import { WhereFields } from "./WhereFields";
import { useLocale } from "../account/LocaleProvider";
import { audToDisplay, displayToAud } from "@/lib/i18n/locale";

// react-day-picker and its stylesheet load only once the traveller opens the When editor.
const TripCalendar = dynamic(() => import("./TripCalendar").then((m) => m.TripCalendar), {
  ssr: false,
});

type FieldsProps = {
  value: Draft;
  onChange(next: Draft): void;
  errors: Record<string, string>;
};

/** The fields one chip edits. */
export function FactFields({
  fact,
  suggestPlaces,
  ...props
}: FieldsProps & { fact: FactKey; suggestPlaces: boolean }) {
  switch (fact) {
    case "where":
      return <WhereFields {...props} suggestPlaces={suggestPlaces} />;
    case "when":
      return <WhenFields {...props} />;
    case "who":
      return <WhoFields {...props} />;
    case "budget":
      return <BudgetFields {...props} />;
    case "preferences":
      return <PreferenceList {...props} />;
  }
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const describedBy =
    [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children(describedBy)}
      {hint && (
        <small className="muted form-field__hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
      {error && (
        <small className="error-text" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}

function TextField({
  name,
  label,
  hint,
  error,
  type = "text",
  value,
  onChange,
  inputProps,
}: {
  name: keyof Draft;
  label: string;
  hint?: string;
  error?: string;
  type?: string;
  value: Draft;
  onChange(next: Draft): void;
  inputProps?: Record<string, string | number>;
}) {
  const id = `fact-${name}`;
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <Input
          id={id}
          className="field"
          type={type}
          value={String(value[name])}
          onChange={(event) => onChange({ ...value, [name]: event.target.value })}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...inputProps}
        />
      )}
    </Field>
  );
}

/** A local calendar date at midnight, matching `toIsoDate`'s local fields (not UTC). */
const parseIsoDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
};

function WhenFields({ value, onChange, errors }: FieldsProps) {
  const { locale, t } = useLocale();
  const range: DateRange | undefined = value.start
    ? { from: parseIsoDate(value.start), to: value.end ? parseIsoDate(value.end) : undefined }
    : undefined;
  const dates = datesLabel(value.start, value.end, locale);
  const clear = () => onChange({ ...value, start: "", end: "" });
  const handleSelect = (next: DateRange | undefined) => {
    if (!next?.from) {
      clear();
      return;
    }
    onChange({
      ...value,
      start: toIsoDate(next.from),
      end: next.to ? toIsoDate(next.to) : "",
    });
  };
  return (
    <div className="when-fields">
      <div className="when-fields__summary">
        <span className={dates ? undefined : "muted"}>
          {dates ? `${dates.range} · ${dates.days}` : t("Choose your travel dates.")}
        </span>
        {(value.start || value.end) && (
          <button type="button" className="when-fields__clear" onClick={clear}>
            {t("Clear")}
          </button>
        )}
      </div>
      <TripCalendar range={range} onSelect={handleSelect} numberOfMonths={2} />
      {errors.dates && (
        <small className="error-text fact-form__error" id="fact-dates-error">
          {errors.dates}
        </small>
      )}
    </div>
  );
}

function WhoFields({ value, onChange, errors }: FieldsProps) {
  const { t } = useLocale();
  const party = partyFor(value);
  const setParty = (next: Party) =>
    onChange({ ...value, party: next, groupSize: String(groupSizeFromParty(next)) });
  return (
    <div className="fact-steppers">
      {PARTY_ROWS.map(({ key, label, hint, singular, article }) => {
        const count = party[key];
        return (
          <div className="fact-steppers__row" key={key}>
            <div className="fact-steppers__label">
              <span>{t(label)}</span>
              {hint && <small className="muted">{t(hint)}</small>}
            </div>
            <div className="fact-stepper">
              <button
                type="button"
                className="fact-stepper__button"
                aria-label={`Remove ${article} ${singular}`}
                disabled={count <= 0}
                onClick={() => setParty({ ...party, [key]: Math.max(0, count - 1) })}
              >
                <MinusIcon />
              </button>
              <span className="fact-stepper__value" aria-label={`${t(label)}: ${count}`}>
                {count}
              </span>
              <button
                type="button"
                className="fact-stepper__button"
                aria-label={`Add ${article} ${singular}`}
                onClick={() => setParty({ ...party, [key]: count + 1 })}
              >
                <PlusIcon />
              </button>
            </div>
          </div>
        );
      })}
      {errors.groupSize && (
        <small className="error-text fact-form__error" id="fact-groupSize-error">
          {errors.groupSize}
        </small>
      )}
    </div>
  );
}

/** Representative amounts (AUD, whole trip): the upper bound of each band, or a round number past
 *  its open end. Selecting one sets `budgetTotal` to it; the card reads as chosen only while the
 *  draft's amount still equals it exactly. */
const BUDGET_PRESETS = [
  { name: "Budget", hint: "under AUD 1,000", value: 900 },
  { name: "Moderate", hint: "AUD 1,000–3,000", value: 3000 },
  { name: "Comfort", hint: "AUD 3,000–6,000", value: 6000 },
  { name: "Luxury", hint: "AUD 6,000+", value: 10000 },
] as const;

function BudgetFields({ value, onChange, errors }: FieldsProps) {
  const { locale, t, currency, money } = useLocale();
  const displayCurrency = currency(value.destination);
  const current = value.budgetTotal.trim() ? Number(value.budgetTotal) : undefined;
  const shown =
    current === undefined
      ? ""
      : String(Math.round(audToDisplay(current, displayCurrency) * 100) / 100);
  return (
    <div className="fact-budget">
      <div className="fact-budget__presets" role="radiogroup" aria-label={t("Budget range")}>
        {BUDGET_PRESETS.map((preset) => {
          const checked = current === preset.value;
          return (
            <button
              key={preset.name}
              type="button"
              role="radio"
              aria-checked={checked}
              className="fact-budget__preset"
              data-checked={checked ? "true" : undefined}
              onClick={() => onChange({ ...value, budgetTotal: String(preset.value) })}
            >
              <span className="fact-budget__preset-name">{t(preset.name)}</span>
              <span className="fact-budget__preset-hint">
                {preset.name === "Budget"
                  ? `${t("under")} ${money(1000, value.destination)}`
                  : preset.name === "Luxury"
                    ? `${money(6000, value.destination)}+`
                    : preset.name === "Moderate"
                      ? `${money(1000, value.destination)}–${money(3000, value.destination)}`
                      : `${money(3000, value.destination)}–${money(6000, value.destination)}`}
              </span>
            </button>
          );
        })}
      </div>
      <Field
        id="fact-budgetTotal"
        label={`${t("Or enter an amount")}${locale === "zh-CN" ? `（${displayCurrency}）` : ` (${displayCurrency})`}`}
        hint={t("For the whole group and the whole trip.")}
        error={errors.budgetTotal}
      >
        {(describedBy) => (
          <Input
            id="fact-budgetTotal"
            className="field"
            type="number"
            value={shown}
            min={0.01}
            step={0.01}
            inputMode="decimal"
            aria-invalid={!!errors.budgetTotal}
            aria-describedby={describedBy}
            onChange={(event) => {
              const entered = event.target.value;
              onChange({
                ...value,
                budgetTotal: entered
                  ? String(Math.round(displayToAud(Number(entered), displayCurrency) * 100) / 100)
                  : "",
              });
            }}
          />
        )}
      </Field>
    </div>
  );
}
