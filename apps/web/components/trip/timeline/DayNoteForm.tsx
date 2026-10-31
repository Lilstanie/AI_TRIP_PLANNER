"use client";
import { useEffect, useRef } from "react";
import { useEditorDraft } from "../editor-drafts";
import { useLocale } from "@/components/account/LocaleProvider";
import { NOTE_MAX, TITLE_MAX } from "@/lib/trip/day-actions";
import { StopEditSurface } from "./StopEditSurface";

export function DayNoteForm({
  mode,
  draftKey,
  value,
  phone = false,
  onSubmit,
  onCancel,
}: {
  mode: "title" | "note";
  draftKey: string;
  value: string;
  phone?: boolean;
  onSubmit(text: string): boolean;
  onCancel(): void;
}) {
  const { t } = useLocale();
  const [text, setText, resetText] = useEditorDraft(draftKey, value);
  const cancel = () => {
    resetText();
    onCancel();
  };
  const first = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => first.current?.focus(), []);
  const label = mode === "title" ? t("dayTitleTitle") : t("dayNote");
  return (
    <StopEditSurface title={label} phone={phone} onClose={onCancel}>
      <form
        className="item-editor"
        onSubmit={(event) => {
          event.preventDefault();
          if (onSubmit(text)) resetText();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          cancel();
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
            {t("save")}
          </button>
          <button type="button" onClick={cancel}>
            {t("cancel")}
          </button>
        </div>
      </form>
    </StopEditSurface>
  );
}
