"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/account/LocaleProvider";
import type { Components } from "react-markdown";
import type { TripPlan } from "@trip/shared";
import { memoryDisplay } from "@/lib/account/memory-display";
import { intlLocale } from "@/lib/i18n/locale";
import { formatMessageClock, WELCOME_MESSAGE, type Message } from "@/lib/workspace";
import { AttachmentChip } from "./AttachmentChip";
import { FlightResults } from "./FlightResults";
import { PlanDays } from "./PlanDays";
import { RevealedText } from "./RevealedText";
import { ThinkingProcess } from "./ThinkingProcess";
import { AssistantIcon } from "./assistants";
import { useAssistantName } from "./assistant-names";
import { CheckIcon, CopyIcon, PencilIcon } from "../ui/icons";

const markdownComponents: Components = {
  a: ({ href, children, ...rest }) => (
    <a {...rest} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

function CopyButton({ text }: { text: string }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const label = t(copied ? "Copied" : "Copy message");
  return (
    <button
      type="button"
      className="msg-action"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          return;
        }
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function EditedBubble({
  text,
  onCancel,
  onResend,
}: {
  text: string;
  onCancel: () => void;
  onResend: (text: string) => void;
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState(text);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = field.current;
    node?.focus();
    node?.setSelectionRange(node.value.length, node.value.length);
  }, []);
  const submit = () => draft.trim() && onResend(draft);
  return (
    <div className="msg-edit">
      <textarea
        ref={field}
        className="msg-edit__field"
        aria-label={t("Edit message")}
        value={draft}
        rows={Math.min(8, Math.max(2, draft.split("\n").length))}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="msg-edit__actions">
        <button type="button" className="msg-edit__button" onClick={onCancel}>
          {t("Cancel")}
        </button>
        <button
          type="button"
          className="msg-edit__button msg-edit__button--primary"
          disabled={!draft.trim()}
          onClick={submit}
        >
          {t("Resend")}
        </button>
      </div>
    </div>
  );
}

export function MessageItem({
  message,
  animate,
  turn,
  onResend,
  onOpenTrip,
  days,
}: {
  message: Message;
  animate?: boolean;
  turn?: number | undefined;
  onResend?: (text: string) => boolean;
  onOpenTrip?: () => void;
  days?: { plan: TripPlan; onOpenDay: (day: number) => void };
}) {
  const { t, locale, notice: localizeNotice } = useLocale();
  const [undone, setUndone] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const assistantName = useAssistantName();
  const [editing, setEditing] = useState(false);
  const clock =
    message.at === undefined ? null : (
      <span className="msg-item__clock">
        {formatMessageClock(message.at, Date.now(), intlLocale(locale))}
      </span>
    );
  if (message.role === "user") {
    return (
      <div className="msg-item msg-item--user">
        <span className="sr-only">{t("You")}</span>
        {message.attachments && message.attachments.length > 0 && (
          <ul className="attachment-chips msg-item__attachments" aria-label={t("Attached files")}>
            {message.attachments.map((attachment, index) => (
              <AttachmentChip
                key={`${attachment.name}:${index}`}
                name={attachment.name}
                kind={attachment.kind}
                {...(attachment.thumbnail ? { thumbnail: attachment.thumbnail } : {})}
                {...(attachment.bytes === undefined ? {} : { bytes: attachment.bytes })}
              />
            ))}
          </ul>
        )}

        {editing && onResend ? (
          <EditedBubble
            text={message.text}
            onCancel={() => setEditing(false)}
            onResend={(text) => {
              if (onResend(text)) setEditing(false);
            }}
          />
        ) : (
          message.text && <div className="msg-item__bubble">{message.text}</div>
        )}
        {clock}
        {message.text && !editing && (
          <div className="msg-actions">
            <CopyButton text={message.text} />
            {onResend && !message.attachments?.length && (
              <button
                type="button"
                className="msg-action"
                aria-label={t("Edit message")}
                title={t("Edit message")}
                onClick={() => setEditing(true)}
              >
                <PencilIcon />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="msg-item msg-item--agent">
      {message.assistant ? (
        <span className="msg-item__who">
          <AssistantIcon id={message.assistant} />
          <strong>{assistantName(message.assistant)}</strong>
        </span>
      ) : (
        <span className="sr-only">{t("Travel planning assistant")}</span>
      )}
      {message.activity && message.activity.length > 0 && (
        <>
          <section className="agent-activity" aria-label={t("Thinking process")}>
            <ThinkingProcess
              activity={message.activity}
              busy={false}
              outcome={message.outcome}
              {...(turn === undefined ? {} : { turn })}
            />
          </section>
        </>
      )}
      <div className="msg-item__body">
        <RevealedText
          text={message.text === WELCOME_MESSAGE ? t(WELCOME_MESSAGE) : message.text}
          components={markdownComponents}
          {...(animate ? { animate } : {})}
        />
      </div>
      {days && <PlanDays plan={days.plan} onOpenDay={days.onOpenDay} />}
      {message.conflictNotice && (
        <p className="msg-item__notice" role="status">
          {localizeNotice(message.conflictNotice)}
        </p>
      )}
      {message.memoryChange && (
        <div role="status" className="msg-item__memory-notice">
          {t(
            message.memoryChange.action === "updated" ? "Updated: {value}" : "Remembered: {value}",
            { value: memoryDisplay(message.memoryChange.value, locale) },
          )}
          <button
            type="button"
            disabled={undone || undoing}
            onClick={async () => {
              setUndoing(true);
              try {
                const response = await fetch("/api/account/memory/undo", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ token: message.memoryChange?.token }),
                });
                if (response.ok && (await response.json()).undone) setUndone(true);
              } finally {
                setUndoing(false);
              }
            }}
          >
            {undone ? t("Undone") : t("Undo")}
          </button>
        </div>
      )}
      {message.flights && <FlightResults answer={message.flights} />}
      {message.outcome === "planned" && onOpenTrip && (
        <button type="button" className="msg-open-trip" onClick={onOpenTrip}>
          {t("Open trip")}
        </button>
      )}
      {clock}
      {message.text && (
        <div className="msg-actions">
          <CopyButton text={message.text} />
        </div>
      )}
    </div>
  );
}
