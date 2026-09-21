"use client";
import { useEffect, useRef, type ChangeEvent, type KeyboardEvent, type RefObject } from "react";
import { PlusIcon, SendIcon } from "../ui/icons";

/**
 * The chat composer, built as one card like DeepSeek Harness's input bar: the
 * text surface fills the top of the capsule, and one control row sits under it
 * with the attach-side control on the left and the primary action on the right.
 *
 * The text surface is a textarea rather than DSH's contenteditable: this app has
 * no attachment chips or inline decorators to render inside the draft, so a
 * textarea gives the same three behaviours that matter here — grow with the
 * content, answer the keyboard, and keep its own scroll once it hits the cap —
 * with far less machinery.
 *
 * Three DSH row controls are deliberately absent, not pending: the command
 * palette, because this app's composer is a single send; the model picker (and
 * the permission/access chip it shares the row with), because there is one
 * model and one user; and the context meter, because there is no token budget
 * to show. Nothing stands in for them.
 */

/** One line plus the card's breathing room; mirrors DSH's docked floor. */
const MIN_HEIGHT_PX = 36;
/** Roughly seven lines, after which the textarea scrolls rather than the card growing. */
const MAX_HEIGHT_PX = 168;

export function Composer({
  value,
  placeholder,
  busy,
  canSend,
  canCancel,
  hint,
  inputRef,
  onInput,
  onSend,
  onCancel,
  onAttachFiles,
}: {
  value: string;
  placeholder: string;
  busy: boolean;
  canSend: boolean;
  canCancel: boolean;
  /** Small copy on the control row: what Enter does, or why the field is locked. */
  hint: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onInput: (value: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  /**
   * Handed the files the traveller picked from the plus control. Optional: the
   * composer works (and still shows the control) without it.
   */
  onAttachFiles?: (files: File[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Grow with the draft, then stop: the composer must not push the transcript
  // off the screen on a long message.
  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(Math.max(field.scrollHeight, MIN_HEIGHT_PX), MAX_HEIGHT_PX)}px`;
  }, [value, inputRef]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter submits; Shift+Enter is the newline. An IME composition is never a
    // submit, which is what lets Chinese and Japanese input be typed at all.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (canSend) onSend();
  }

  function onPickFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.currentTarget.files ?? []);
    onAttachFiles?.(picked);
    // Reset the field so picking the same file again still fires a change.
    event.currentTarget.value = "";
  }

  return (
    <div className="composer" data-busy={busy || undefined}>
      <textarea
        ref={inputRef}
        className="composer__input"
        aria-label="Message AI Trip Planner"
        placeholder={placeholder}
        rows={1}
        value={value}
        disabled={busy}
        onChange={(event) => onInput(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="composer__row">
        <div className="composer__tools">
          <button
            type="button"
            className="composer__add"
            aria-label="Upload files"
            title="Upload files"
            disabled={busy}
            // The pick target must not steal the draft's focus (DSH's keepFocus).
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <PlusIcon />
          </button>
          <input
            ref={fileInputRef}
            className="composer__file-input"
            type="file"
            multiple
            hidden
            disabled={busy}
            onChange={onPickFiles}
          />
          <span className="composer__hint">{hint}</span>
        </div>
        <div className="composer__trailing">
          {busy ? (
            <button
              type="button"
              className="composer__primary composer__primary--stop"
              aria-label="Stop planning"
              disabled={!canCancel}
              onClick={onCancel}
            >
              <span className="composer__stop-glyph" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="composer__primary"
              aria-label="Send"
              disabled={!canSend}
              // Not `onClick={onSend}`: the caller's send() reads an optional message
              // argument, and a click event is not one.
              onClick={() => onSend()}
            >
              <SendIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
