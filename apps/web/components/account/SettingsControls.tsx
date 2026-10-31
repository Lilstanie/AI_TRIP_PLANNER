"use client";
import { useRef, useState, type ReactNode } from "react";
import { keyForText, type EnglishText, type MessageKey } from "@/lib/i18n/locale";
import type { Notice } from "@/lib/i18n/notice";
import { useSegmentIndicator } from "../ui/motion";
import { useLocale } from "./LocaleProvider";

export function SettingRow({
  label,
  value,
  action = "change",
  children,
}: {
  label: string;
  value: ReactNode;
  action?: MessageKey;
  children?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { t, notice: localizeNotice } = useLocale();
  return (
    <div className="settings-row-item">
      <div className="settings-row-item__line">
        <div className="settings-row-item__text">
          <strong>{label}</strong>
          <span>{value}</span>
        </div>
        {children && (
          <button
            type="button"
            className="settings-pill"
            aria-expanded={open}
            aria-label={`${t(open ? "close" : action)} ${label}`}
            onClick={() => setOpen(!open)}
          >
            {t(open ? "done" : action)}
          </button>
        )}
      </div>
      {open && children && (
        <div className="settings-row-item__editor">{children(() => setOpen(false))}</div>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T | undefined;
  onChange(next: T | undefined): void;
}) {
  const track = useRef<HTMLDivElement>(null);
  useSegmentIndicator(track, value);
  return (
    <div ref={track} className="segmented settings-segmented" role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function ChipGroup<T extends EnglishText>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T[];
  onChange(next: T[]): void;
}) {
  const { t, notice: localizeNotice } = useLocale();
  return (
    <div className="settings-chips" role="group" aria-label={label}>
      {options.map((option) => {
        const on = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            className="settings-chip"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter((item) => item !== option) : [...value, option])
            }
          >
            {t(keyForText(option))}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange(next: boolean): void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="settings-switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden="true" />
    </button>
  );
}

export function MemoryRow({
  icon,
  label,
  value,
  question,
  children,
}: {
  icon: string;
  label: string;
  value: string;
  question: string;
  children: (close: () => void) => ReactNode;
}) {
  const { t, notice: localizeNotice } = useLocale();
  const [open, setOpen] = useState(false);
  const empty = !value;
  return (
    <li className="memory-row" data-empty={empty || undefined}>
      <button
        type="button"
        className="memory-row__main"
        aria-expanded={open}
        aria-label={t("editV0", { v0: label })}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">{icon}</span>
        <span>
          <strong>{label}:</strong> {empty ? question : value}
        </span>
      </button>
      {empty && !open && (
        <button
          type="button"
          className="memory-row__answer"
          aria-label={t("answerV0", { v0: label })}
          onClick={() => setOpen(true)}
        >
          {t("answer")}
        </button>
      )}
      {open && <div className="memory-row__editor">{children(() => setOpen(false))}</div>}
    </li>
  );
}

export function TextEditor({
  label,
  initial,
  numeric,
  validate,
  onSave,
}: {
  label: string;
  initial: string;
  numeric?: boolean;
  validate?(value: string): Notice | undefined;
  onSave(value: string): void;
}) {
  const { t, notice: localizeNotice } = useLocale();
  const [value, setValue] = useState(initial);
  const problem = validate?.(value);
  return (
    <form
      className="settings-inline"
      onSubmit={(event) => {
        event.preventDefault();
        if (!problem) onSave(value.trim());
      }}
    >
      <input
        aria-label={label}
        value={value}
        inputMode={numeric ? "decimal" : undefined}
        aria-invalid={Boolean(problem) || undefined}
        onChange={(event) =>
          setValue(numeric ? event.target.value.replace(/[^\d.]/g, "") : event.target.value)
        }
      />
      <button
        type="submit"
        className="settings-pill settings-pill--ink"
        disabled={Boolean(problem)}
      >
        {t("save")}
      </button>
      {problem && <small className="settings-error">{localizeNotice(problem)}</small>}
    </form>
  );
}
