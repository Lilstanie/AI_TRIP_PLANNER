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
import type { Notice } from "@/lib/i18n/notice";
import { useLocale } from "../account/LocaleProvider";

const MIN_HEIGHT_PX = 36;

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
  attachNotices = [],
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

  onAttachFiles?: (files: File[]) => void;

  attachments?: PreparedAttachment[];

  onRemoveAttachment?: (id: string) => void;

  canAttach?: boolean;

  attachNotices?: readonly Notice[];
}) {
  const { t, notice: localizeNotice } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const dragDepth = useRef(0);
  const attachable = Boolean(onAttachFiles) && canAttach && !busy;

  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(Math.max(field.scrollHeight, MIN_HEIGHT_PX), MAX_HEIGHT_PX)}px`;
  }, [value, inputRef]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (canSend) onSend();
  }

  function onPickFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.currentTarget.files ?? []);
    onAttachFiles?.(picked);

    event.currentTarget.value = "";
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (!files.length || !attachable) return;

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
        <ul className="attachment-chips composer__attachments" aria-label={t("Attached files")}>
          {attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              name={attachment.name}
              kind={attachment.kind}
              bytes={attachment.bytes}
              {...(attachment.thumbnail ? { thumbnail: attachment.thumbnail } : {})}
              {...(attachment.truncated ? { truncated: true } : {})}
              {...(onRemoveAttachment ? { onRemove: () => onRemoveAttachment(attachment.id) } : {})}
            />
          ))}
        </ul>
      )}
      {attachNotices.length > 0 && (
        <p className="composer__notice" role="status">
          {attachNotices.map((notice) => localizeNotice(notice)).join(" ")}
        </p>
      )}
      <textarea
        ref={inputRef}
        className="composer__input"
        aria-label={t("Message AI Trip Planner")}
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
            aria-label={t("Upload files")}
            title={t("Upload files")}
            disabled={busy || !canAttach}

            onMouseDown={(event) => event.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <PlusIcon />
          </button>
          <input
            ref={fileInputRef}
            className="composer__file-input"
            type="file"
            aria-label={t("Add files")}
            multiple

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
              aria-label={t("Stop planning")}
              disabled={!canCancel}
              onClick={onCancel}
            >
              <span className="composer__stop-glyph" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="composer__primary"
              aria-label={t("Send")}
              disabled={!canSend}

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
