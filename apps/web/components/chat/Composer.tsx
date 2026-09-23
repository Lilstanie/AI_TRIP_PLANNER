"use client";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { PlusIcon, SendIcon } from "../ui/icons";
import { AttachmentChip } from "./AttachmentChip";
import type { PreparedAttachment } from "@/lib/chat/attachments";

/**
 * The chat composer, built as one card like DeepSeek Harness's input bar: the
 * text surface fills the top of the capsule, attachment chips sit above it, and
 * one control row sits under it with the attach-side control on the left and the
 * primary action on the right.
 *
 * The text surface is a textarea rather than DSH's contenteditable. DSH renders
 * its chips as decorator portals inside the editor; here they are ordinary DOM
 * above the field, which gives the same three behaviours that matter — the
 * draft grows with its content, answers the keyboard, and keeps its own scroll
 * once it hits the cap — with far less machinery, and lets the chips be real
 * list items with real buttons.
 *
 * Files arrive three ways, all of them landing in `onAttachFiles`: the picker
 * behind the plus control, a drop anywhere on the card, and a paste — an image
 * on the clipboard is the common case, and it has no file name to lose.
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
  inputRef,
  onInput,
  onSend,
  onCancel,
  onAttachFiles,
  attachments = [],
  onRemoveAttachment,
  canAttach = true,
  attachNotice,
}: {
  value: string;
  placeholder: string;
  busy: boolean;
  canSend: boolean;
  canCancel: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onInput: (value: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  /**
   * Handed every file the traveller picked, dropped or pasted. Optional: the
   * composer works (and still shows the control) without it.
   */
  onAttachFiles?: (files: File[]) => void;
  /** Files already held for the next message, drawn as chips above the draft. */
  attachments?: PreparedAttachment[];
  /** Drops one held file by id. */
  onRemoveAttachment?: (id: string) => void;
  /** False once the per-message limit is reached; `attachNotice` says why. */
  canAttach?: boolean;
  /** One short line under the chips: why a file was refused, or that the limit is reached. */
  attachNotice?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // A drag over a child fires dragleave on the parent; count the entries so the
  // highlight survives the pointer crossing the field or a chip.
  const dragDepth = useRef(0);
  const attachable = Boolean(onAttachFiles) && canAttach && !busy;

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

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (!files.length || !attachable) return;
    // A screenshot on the clipboard also arrives as an empty text item; taking
    // the files means the draft does not gain a stray newline.
    event.preventDefault();
    onAttachFiles?.(files);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    dragDepth.current = 0;
    setDragging(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) return;
    event.preventDefault();
    if (attachable) onAttachFiles?.(files);
  }

  const dragProps = onAttachFiles
    ? {
        onDragEnter: (event: DragEvent<HTMLDivElement>) => {
          if (!Array.from(event.dataTransfer?.types ?? []).includes("Files")) return;
          dragDepth.current += 1;
          setDragging(true);
        },
        onDragOver: (event: DragEvent<HTMLDivElement>) => {
          // Without this the browser opens the dropped file instead.
          if (Array.from(event.dataTransfer?.types ?? []).includes("Files")) event.preventDefault();
        },
        onDragLeave: () => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        },
        onDrop,
      }
    : {};

  return (
    <div
      className="composer"
      data-busy={busy || undefined}
      data-dragging={dragging || undefined}
      {...dragProps}
    >
      {attachments.length > 0 && (
        <ul className="attachment-chips composer__attachments" aria-label="Attached files">
          {attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              name={attachment.name}
              kind={attachment.kind}
              bytes={attachment.bytes}
              {...(attachment.thumbnail ? { thumbnail: attachment.thumbnail } : {})}
              {...(attachment.truncated ? { truncated: true } : {})}
              {...(onRemoveAttachment
                ? { onRemove: () => onRemoveAttachment(attachment.id) }
                : {})}
            />
          ))}
        </ul>
      )}
      {attachNotice && (
        // A status line, not a toast: a rejected file is something to read and
        // act on, and it stays until the next pick replaces it.
        <p className="composer__notice" role="status">
          {attachNotice}
        </p>
      )}
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
        onPaste={onPaste}
      />
      <div className="composer__row">
        <div className="composer__tools">
          <button
            type="button"
            className="composer__add"
            aria-label="Upload files"
            title="Upload files"
            disabled={busy || !canAttach}
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
            aria-label="Add files"
            multiple
            // Visually hidden rather than `hidden`, so the field stays in the
            // accessibility tree for a reader that drives the input directly.
            // Out of the tab order: the plus button beside it is the tab stop.
            tabIndex={-1}
            disabled={busy || !canAttach}
            onChange={onPickFiles}
          />
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
