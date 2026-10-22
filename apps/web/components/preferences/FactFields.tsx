"use client";
import dynamic from "next/dynamic";
import type { DateRange } from "react-day-picker";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fromAud, toAud } from "@trip/shared";
import { statedBudgetSource } from "@/lib/workspace";
import { CurrencyNotice } from "../account/CurrencyNotice";
import { groupSizeFromParty, partyFor, type Draft, type Party } from "@/lib/workspace";
import { toIsoDate } from "@/lib/planning/date-range";
import { datesLabel, PARTY_ROWS, type FactKey } from "@/lib/workspace/trip-facts";
import { MinusIcon, PlusIcon } from "../ui/icons";
import { Input } from "../ui/input";
import { PreferenceList } from "./PreferenceList";
import { WhereFields } from "./WhereFields";
import { useLocale } from "../account/LocaleProvider";
import type { Notice } from "@/lib/i18n/notice";

const TripCalendar = dynamic(() => import("./TripCalendar").then((m) => m.TripCalendar), {
  ssr: false,
});

type FieldsProps = {
  value: Draft;
  onChange(next: Draft): void;
  errors: Record<string, Notice>;
};

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
  error?: Notice;
  hint?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const { notice: localizeNotice } = useLocale();
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
        <small className="error-text" role="alert" id={`${id}-error`}>
          {localizeNotice(error)}
        </small>
      )}
    </div>
  );
}

const parseIsoDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
};

function WhenFields({ value, onChange, errors }: FieldsProps) {
  const { locale, t, notice: localizeNotice } = useLocale();
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
          {errors.dates
            ? t("Choose an end date")
            : dates
              ? `${dates.range} · ${dates.days}`
              : t("Choose your travel dates.")}
        </span>
        {(value.start || value.end) && (
          <button type="button" className="when-fields__clear" onClick={clear}>
            {t("Clear")}
          </button>
        )}
      </div>
      <TripCalendar
        range={range}
        defaultMonth={range?.from}
        onSelect={handleSelect}
        numberOfMonths={2}
        ariaDescribedBy={errors.dates ? "fact-dates-error" : undefined}
      />
      {errors.dates && (
        <small className="error-text fact-form__error" role="alert" id="fact-dates-error">
          {localizeNotice(errors.dates)}
        </small>
      )}
    </div>
  );
}

function WhoFields({ value, onChange, errors }: FieldsProps) {
  const { t, locale, notice: localizeNotice } = useLocale();
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
                aria-describedby={errors.groupSize ? "fact-groupSize-error" : undefined}
                aria-label={t("Remove {v0} {v1}", {
                  v0: locale === "zh" ? "" : article,
                  v1: locale === "zh" ? t(label) : singular,
                })}
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
                aria-describedby={errors.groupSize ? "fact-groupSize-error" : undefined}
                aria-label={t("Add {v0} {v1}", {
                  v0: locale === "zh" ? "" : article,
                  v1: locale === "zh" ? t(label) : singular,
                })}
                onClick={() => setParty({ ...party, [key]: count + 1 })}
              >
                <PlusIcon />
              </button>
            </div>
          </div>
        );
      })}
      {errors.groupSize && (
        <small className="error-text fact-form__error" role="alert" id="fact-groupSize-error">
          {localizeNotice(errors.groupSize)}
        </small>
      )}
    </div>
  );
}

const BUDGET_PRESETS = [
  { name: "Budget|tier", value: 900 },
  { name: "Moderate", value: 3000 },
  { name: "Comfort", value: 6000 },
  { name: "Luxury", value: 10000 },
] as const;

const BUDGET_PRESET_STEP: Record<string, number | undefined> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

function BudgetFields({ value, onChange, errors }: FieldsProps) {
  const { t, currency, money } = useLocale();
  const source = statedBudgetSource(value);
  const current = value.budgetTotal.trim() ? Number(value.budgetTotal) : undefined;
  const presetRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = BUDGET_PRESETS.findIndex((preset) => preset.value === current);
  const tabStop = checkedIndex === -1 ? 0 : checkedIndex;
  const choose = (index: number) => {
    const preset = BUDGET_PRESETS[index];
    onChange({
      ...value,
      budgetTotal: String(preset.value),
      budgetSource: { amount: fromAud(preset.value, currency), currency },
    });
    presetRefs.current[index]?.focus();
  };
  return (
    <div className="fact-budget">
      <div className="fact-budget__presets" role="radiogroup" aria-label={t("Budget range")}>
        {BUDGET_PRESETS.map((preset, index) => {
          const checked = current === preset.value;
          return (
            <button
              key={preset.name}
              ref={(node) => {
                presetRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={index === tabStop ? 0 : -1}
              className="fact-budget__preset"
              data-checked={checked ? "true" : undefined}
              onClick={() => choose(index)}
              onKeyDown={(event) => {
                const step = BUDGET_PRESET_STEP[event.key];
                if (step === undefined) return;
                event.preventDefault();
                choose((index + step + BUDGET_PRESETS.length) % BUDGET_PRESETS.length);
              }}
            >
              <span className="fact-budget__preset-name">{t(preset.name)}</span>
              <span className="fact-budget__preset-hint">{money(preset.value)}</span>
            </button>
          );
        })}
      </div>
      <Field
        id="fact-budgetTotal"
        label={`${t("Or enter an amount")} (${currency})`}
        hint={t("For the whole group and the whole trip, in {currency}.").replace(
          "{currency}",
          currency,
        )}
        error={errors.budgetTotal}
      >
        {(describedBy) => (
          <BudgetInput
            value={value}
            currency={currency}
            source={source}
            describedBy={describedBy}
            invalid={!!errors.budgetTotal}
            onChange={onChange}
          />
        )}
      </Field>
      <CurrencyNotice />
    </div>
  );
}

function BudgetInput({
  value,
  currency,
  source,
  describedBy,
  invalid,
  onChange,
}: {
  value: Draft;
  currency: import("@trip/shared").Currency;
  source?: Draft["budgetSource"];
  describedBy?: string;
  invalid: boolean;
  onChange(next: Draft): void;
}) {
  const displayed =
    value.budgetTotal.trim() && Number.isFinite(Number(value.budgetTotal))
      ? source?.currency === currency
        ? source.amount
        : fromAud(Number(value.budgetTotal), currency)
      : "";
  const [input, setInput] = useState(String(displayed));
  useEffect(() => {
    if (value.budgetTotal !== "invalid") setInput(String(displayed));
  }, [displayed, value.budgetTotal]);
  return (
    <Input
      id="fact-budgetTotal"
      className="field"
      type="number"
      value={input}
      min={currency === "JPY" ? 1 : 0.01}
      step={currency === "JPY" ? 1 : 0.01}
      inputMode="decimal"
      aria-invalid={invalid}
      aria-describedby={describedBy}
      onChange={(event) => {
        const text = event.target.value;
        setInput(text);
        const amount = Number(text);
        let aud = "";
        try {
          aud = String(toAud(amount, currency));
        } catch {}
        onChange({
          ...value,
          budgetTotal: aud || (text.trim() ? "invalid" : ""),
          budgetSource: aud ? { amount, currency } : undefined,
        });
      }}
    />
  );
}
