"use client";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import type { Draft } from "@/lib/workspace";
import type { FactKey } from "@/lib/workspace/trip-facts";
import { CalendarIcon, MinusIcon, PlusIcon } from "../ui/icons";
import { Input } from "../ui/input";
import { PreferenceList } from "./PreferenceList";
import { WhereFields } from "./WhereFields";

// react-day-picker and its stylesheet load only once the traveller opens the calendar.
const DateRangePicker = dynamic(() => import("./DateRangePicker").then((m) => m.DateRangePicker), {
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

function WhenFields({ value, onChange, errors }: FieldsProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const dateErrorProps = errors.dates
    ? { "aria-invalid": "true", "aria-describedby": "fact-dates-error" }
    : undefined;
  return (
    <>
      <div className="filter-dates">
        <TextField
          name="start"
          label="Start date"
          type="date"
          value={value}
          onChange={onChange}
          inputProps={dateErrorProps}
        />
        <TextField
          name="end"
          label="End date"
          type="date"
          value={value}
          onChange={onChange}
          inputProps={dateErrorProps}
        />
        <button
          type="button"
          className="filter-dates__calendar"
          aria-label="Pick trip dates from a calendar"
          onClick={() => setShowCalendar(true)}
        >
          <CalendarIcon />
        </button>
      </div>
      {errors.dates && (
        <small className="error-text fact-form__error" id="fact-dates-error">
          {errors.dates}
        </small>
      )}
      {showCalendar && (
        <DateRangePicker
          onConfirm={({ start, end }) => onChange({ ...value, start, end })}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </>
  );
}

function WhoFields({ value, onChange, errors }: FieldsProps) {
  const count = Number(value.groupSize);
  const known = value.groupSize.trim() !== "" && Number.isInteger(count);
  const step = (by: number) =>
    onChange({ ...value, groupSize: String(Math.max(1, (known ? count : 0) + by)) });
  return (
    <Field id="fact-groupSize" label="Travellers" error={errors.groupSize}>
      {(describedBy) => (
        <div className="fact-stepper">
          <button
            type="button"
            className="fact-stepper__button"
            aria-label="Remove a traveller"
            disabled={!known || count <= 1}
            onClick={() => step(-1)}
          >
            <MinusIcon />
          </button>
          <Input
            id="fact-groupSize"
            className="field fact-stepper__value"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={value.groupSize}
            onChange={(event) => onChange({ ...value, groupSize: event.target.value })}
            aria-invalid={!!errors.groupSize}
            aria-describedby={describedBy}
          />
          <button
            type="button"
            className="fact-stepper__button"
            aria-label="Add a traveller"
            onClick={() => step(1)}
          >
            <PlusIcon />
          </button>
        </div>
      )}
    </Field>
  );
}

function BudgetFields({ value, onChange, errors }: FieldsProps) {
  return (
    <TextField
      name="budgetTotal"
      label="Total budget (AUD)"
      hint="For the whole group and the whole trip, in Australian dollars."
      type="number"
      error={errors.budgetTotal}
      value={value}
      onChange={onChange}
      inputProps={{ min: 0.01, step: 0.01, inputMode: "decimal" }}
    />
  );
}
