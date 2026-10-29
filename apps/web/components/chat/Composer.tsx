"use client";
import {
  useEffect,
  useId,
  useMemo,
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
import { useSettings } from "../account/SettingsProvider";
import { ASSISTANT_ORDER, assistantName } from "./assistant-names";
import { MentionMenu, type MentionEntry } from "./MentionMenu";
import { activeMention, matchesMention, mentionBefore, mentionToken, roleNames } from "./mentions";

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
  const { t, locale, notice: localizeNotice } = useLocale();
  const { settings } = useSettings();
  const customNames = settings.assistant.names;
  const menuId = useId();
  const [caret, setCaret] = useState(-1);
  const [composing, setComposing] = useState(false);
  const [dismissed, setDismissed] = useState<{ start: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const pendingCaret = useRef<number | null>(null);
  const entries = useMemo<MentionEntry[]>(
    () =>
      ASSISTANT_ORDER.map((id) => ({
        id,
        name: assistantName(id, customNames, locale),
        aliases: [assistantName(id, customNames, locale), ...roleNames(id)],
      })),
    [customNames, locale],
  );
  const known = useMemo(() => entries.flatMap((entry) => entry.aliases), [entries]);
  const mention = !composing && caret >= 0 ? activeMention(value, caret, known) : null;
  const matches = mention
    ? entries.filter((entry) => matchesMention(mention.query, entry.aliases))
    : [];
  const menuOpen =
    matches.length > 0 &&
    !(
      dismissed &&
      mention &&
      dismissed.start === mention.start &&
      dismissed.query === mention.query
    );
  const active = Math.min(highlight, Math.max(matches.length - 1, 0));
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

  useEffect(() => {
    const field = inputRef.current;
    if (pendingCaret.current === null || !field) return;
    field.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value, inputRef]);

  function track(field: HTMLTextAreaElement) {
    const next = field.selectionStart === field.selectionEnd ? field.selectionStart : -1;
    const found = next >= 0 ? activeMention(field.value, next, known) : null;
    setCaret(next);
    setHighlight((current) => (found && mention && found.start === mention.start ? current : 0));
    setDismissed((current) =>
      current && found && current.start === found.start && current.query === found.query
        ? current
        : null,
    );
  }

  function pick(entry: MentionEntry) {
    if (!mention) return;
    const token = mentionToken(entry.name);
    const rest = value.slice(caret);
    const inserted = `${token}${/^\s/.test(rest) ? "" : " "}`;
    const landed = mention.start + token.length + 1;
    pendingCaret.current = landed;
    setCaret(landed);
    const next = `${value.slice(0, mention.start)}${inserted}${rest}`;
    onInput(next);
    setDismissed(activeMention(next, caret, known));
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const composingNow = event.nativeEvent.isComposing || composing;
    if (menuOpen && !composingNow) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlight((active + step + matches.length) % matches.length);
        return;
      }
      if ((event.key === "Tab" || event.key === "Enter") && !event.shiftKey) {
        event.preventDefault();
        pick(matches[active]!);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setDismissed(mention);
        return;
      }
    }
    if (event.key === "Backspace" && !composingNow) {
      const field = event.currentTarget;
      if (field.selectionStart === field.selectionEnd) {
        const range = mentionBefore(value, field.selectionStart, known);
        if (range) {
          event.preventDefault();
          field.setSelectionRange(range[0], range[1]);
          track(field);
          return;
        }
      }
    }
    if (event.key !== "Enter" || event.shiftKey || composingNow) return;
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
      {menuOpen && (
        <MentionMenu menuId={menuId} entries={matches} activeIndex={active} onPick={pick} />
      )}
      <textarea
        ref={inputRef}
        className="composer__input"
        aria-label={t("Message AI Trip Planner")}
        placeholder={placeholder}
        rows={1}
        value={value}
        readOnly={busy}
        aria-autocomplete="list"
        {...(menuOpen
          ? {
              "aria-controls": menuId,
              "aria-activedescendant": `${menuId}-${matches[active]!.id}`,
            }
          : {})}
        onChange={(event) => {
          onInput(event.target.value);
          track(event.target);
        }}
        onSelect={(event) => track(event.currentTarget)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(event) => {
          setComposing(false);
          track(event.currentTarget);
        }}
        onBlur={() => setCaret(-1)}
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
