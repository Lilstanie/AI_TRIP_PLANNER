"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/account/LocaleProvider";
import { NOTE_MAX, TITLE_MAX } from "@/lib/trip/day-actions";
import { StopEditSurface } from "./StopEditSurface";

export function DayNoteForm({
  mode,
  value,
  phone = false,
  onSubmit,
  onCancel,
}: {
  mode: "title" | "note";
  value: string;
  phone?: boolean;
  onSubmit(text: string): void;
  onCancel(): void;
}) {
  const { t } = useLocale();
  const [text, setText] = useState(value);
  const first = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => first.current?.focus(), []);
  const label = mode === "title" ? t("Day title") : t("Day note");
  return (
    <StopEditSurface title={label} phone={phone} onClose={onCancel}>
      <form
        className="item-editor"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(text);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }}
      >
        <label>
          {label}
          {mode === "title" ? (
            <input
              ref={first}
              value={text}
              maxLength={TITLE_MAX}
              onChange={(event) => setText(event.target.value)}
            />
          ) : (
            <textarea
              ref={first}
              value={text}
              maxLength={NOTE_MAX}
              rows={3}
              onChange={(event) => setText(event.target.value)}
            />
          )}
        </label>
        <div className="item-editor__actions">
          <button type="submit" className="primary">
            {t("Save")}
          </button>
          <button type="button" onClick={onCancel}>
            {t("Cancel")}
          </button>
        </div>
      </form>
    </StopEditSurface>
  );
}
