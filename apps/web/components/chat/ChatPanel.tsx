"use client";
import { useEffect, useMemo, useRef } from "react";
import { type AgentProgressEvent, type TripPlan } from "@trip/shared";
import { quickPrompts } from "@/lib/planning/quick-prompts";
import type { Message } from "@/lib/workspace";
import { ThinkingProcess } from "./ThinkingProcess";
import { Composer } from "./Composer";
import { MessageItem } from "./MessageItem";
import { QuestionComposer } from "./QuestionComposer";
import type { PendingAsk, QuestionAnswer } from "@/lib/workspace/ask-user";
import type { PreparedAttachment } from "@/lib/chat/attachments";
import type { Notice } from "@/lib/i18n/notice";
import { useLocale } from "../account/LocaleProvider";

export function ChatPanel({
  plan,
  messages,
  input,
  onInput,
  busy,
  locked = false,
  activity,
  onSend,
  onEdit,
  onStart,
  onCancel,
  error,
  onAttachFiles,
  attachments,
  onRemoveAttachment,
  canAttach,
  attachNotices,
  ask,
  onAnswer,
  onDismissAsk,
}: {
  plan?: TripPlan;
  messages: Message[];
  input: string;
  onInput: (value: string) => void;
  busy: boolean;

  locked?: boolean;
  activity: AgentProgressEvent[];

  onSend: (message?: string) => void;
  onEdit: () => void;

  onStart?: () => void;

  onCancel?: () => void;

  error?: Notice;

  onAttachFiles?: (files: File[]) => void;

  attachments?: PreparedAttachment[];

  onRemoveAttachment?: (id: string) => void;

  canAttach?: boolean;

  attachNotices?: readonly Notice[];

  ask?: PendingAsk;

  onAnswer?: (answers: QuestionAnswer[]) => void;

  onDismissAsk?: () => void;
}) {
  const { t } = useLocale();
  const stream = useRef<HTMLDivElement>(null);

  const restored = useRef(messages.length);
  const last = messages.length - 1;
  const revealIndex = last >= restored.current && messages[last]?.role === "agent" ? last : -1;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (messages.length || activity.length)
      stream.current?.scrollTo({ top: stream.current.scrollHeight });
  }, [messages, activity]);

  const prompts = useMemo(() => quickPrompts(), []);
  return (
    <section className="panel chat" aria-label={t("Chat")}>
      <div className="chat__stream" ref={stream} aria-busy={busy}>
        {!plan && !messages.length && (
          <div className="chat-empty">
            <h3>{t("Where to next?")}</h3>
            <p>
              {t(
                "Describe your destination, travel dates, number of travellers and total budget, or add them in the bar at the top.",
              )}
            </p>
            <div className="chat-empty__suggestions" aria-label={t("Example trips")}>
              {prompts.map(({ label, text }) => (
                <button
                  key={t(label)}
                  type="button"
                  title={t(label)}
                  disabled={busy || locked}
                  onClick={() => onSend(text)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="chat-empty__input-hint">
              {t("Pick an example to plan it now, or write your own below.")}
            </p>
            {onStart && (
              <button type="button" onClick={onStart}>
                {t("Add trip details")}
              </button>
            )}
          </div>
        )}
        <div role="log" aria-live="polite">
          {messages.map((m, i) => (
            <MessageItem key={i} message={m} animate={i === revealIndex} />
          ))}
        </div>
        {(activity.length > 0 || busy) && (
          <section
            className={`agent-activity${error && !busy ? " agent-activity--error" : ""}`}
            aria-label={t("Thinking process")}
          >
            <ThinkingProcess activity={activity} busy={busy} error={error} />
          </section>
        )}
      </div>
      {ask && onAnswer && onDismissAsk ? (
        <QuestionComposer key={ask.key} request={ask} onSubmit={onAnswer} onCancel={onDismissAsk} />
      ) : (
        <form
          className="chat__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!locked) onSend();
          }}
        >
          <Composer
            value={input}
            placeholder={t(
              plan ? "Tell me what to change…" : "Destination, dates, travellers and budget…",
            )}
            busy={busy}
            canSend={!locked && (Boolean(input.trim()) || Boolean(attachments?.length))}
            canCancel={Boolean(onCancel)}
            inputRef={inputRef}
            onInput={onInput}
            onSend={onSend}
            {...(onCancel ? { onCancel } : {})}
            {...(onAttachFiles ? { onAttachFiles } : {})}
            {...(attachments ? { attachments } : {})}
            {...(onRemoveAttachment ? { onRemoveAttachment } : {})}
            {...(canAttach === undefined ? {} : { canAttach })}
            {...(attachNotices ? { attachNotices } : {})}
          />
        </form>
      )}
      <p className="disclaimer">
        {t("Estimates require verification. Nothing here makes a booking.")}
      </p>
    </section>
  );
}
