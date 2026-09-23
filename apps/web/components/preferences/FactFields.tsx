"use client";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import type { Draft } from "@/lib/workspace";
import type { FactKey } from "@/lib/workspace/trip-facts";
import { CalendarIcon, MinusIcon, PlusIcon } from "../ui/icons";
import { Input } from "../ui/input";

// react-day-picker and its stylesheet load only once the traveller opens the calendar.
const DateRangePicker = dynamic(() => import("./DateRangePicker").then((m) => m.DateRangePicker), {
  ssr: false,
});

type FieldsProps = {
  value: Draft;
  onChange(next: Draft): void;
  errors: Record<string, string>;
};

/** The fields one chip edits. Labels are the ones the old preferences drawer used. */
export function FactFields({ fact, ...props }: FieldsProps & { fact: FactKey }) {
  switch (fact) {
    case "where":
      return <WhereFields {...props} />;
    case "when":
      return <WhenFields {...props} />;
    case "who":
      return <WhoFields {...props} />;
    case "budget":
      return <BudgetFields {...props} />;
    case "preferences":
      return <PreferenceFields {...props} />;
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

function WhereFields({ value, onChange, errors }: FieldsProps) {
  return (
    <>
      <TextField
        name="destination"
        label="Destination"
        hint="Separate multiple cities with &; allow at least one night per city."
        error={errors.destination}
        value={value}
        onChange={onChange}
        inputProps={{ autoComplete: "off" }}
      />
      <TextField
        name="origin"
        label="Departing from (optional)"
        hint="Leave blank to skip long-haul flight pricing and plan the destination only."
        error={errors.origin}
        value={value}
        onChange={onChange}
        inputProps={{ autoComplete: "off" }}
      />
    </>
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

function PreferenceFields({ value, onChange, errors }: FieldsProps) {
  return (
    <>
      <TextField
        name="nationality"
        label="Nationality / passport (optional)"
        error={errors.nationality}
        value={value}
        onChange={onChange}
        inputProps={{ autoComplete: "off" }}
      />
      <h3 className="fact-form__group">Accommodation</h3>
      <div className="form-field">
        <label htmlFor="fact-roomAllocation">Room allocation</label>
        <select
          id="fact-roomAllocation"
          className="field"
          value={value.roomAllocation}
          onChange={(event) =>
            onChange({ ...value, roomAllocation: event.target.value as Draft["roomAllocation"] })
          }
        >
          <option value="shared">Shared · up to 2 guests per room</option>
          <option value="individual">Individual · 1 room per guest</option>
        </select>
      </div>
      <TextField
        name="minRating"
        label="Minimum guest rating (out of 10)"
        type="number"
        error={errors.accommodation}
        value={value}
        onChange={onChange}
        inputProps={{ min: 0, max: 10, step: 0.1, inputMode: "decimal" }}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={value.freeCancellation}
          onChange={(event) => onChange({ ...value, freeCancellation: event.target.checked })}
        />
        Free cancellation required
      </label>
    </>
  );
}
