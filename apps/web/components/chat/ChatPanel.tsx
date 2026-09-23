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

export function ChatPanel({
  plan,
  messages,
  input,
  onInput,
  busy,
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
  attachNotice,
  ask,
  onAnswer,
  onDismissAsk,
}: {
  /** Undefined for a blank conversation that has not produced a plan. */
  plan?: TripPlan;
  messages: Message[];
  input: string;
  onInput: (value: string) => void;
  busy: boolean;
  activity: AgentProgressEvent[];
  /** Optional text sends that message instead of the composer's contents. */
  onSend: (message?: string) => void;
  onEdit: () => void;
  /** Opens Trip preferences from the blank-conversation prompt. */
  onStart?: () => void;
  /** Cancels the active request without changing the current plan. */
  onCancel?: () => void;
  /** High-level request error shown in the workspace. */
  error?: string;
  /** Receives files picked, dropped or pasted into the composer. */
  onAttachFiles?: (files: File[]) => void;
  /** Files held for the next message, drawn as chips inside the composer. */
  attachments?: PreparedAttachment[];
  /** Drops one held file by id. */
  onRemoveAttachment?: (id: string) => void;
  /** False at the per-message attachment limit. */
  canAttach?: boolean;
  /** One line under the chips explaining a refusal or the limit. */
  attachNotice?: string;
  /** A structured question awaiting an answer; its card takes the composer's seat. */
  ask?: PendingAsk;
  /** Receives the question card's answers. */
  onAnswer?: (answers: QuestionAnswer[]) => void;
  /** Dismisses the question card and brings the composer back. */
  onDismissAsk?: () => void;
}) {
  const stream = useRef<HTMLDivElement>(null);
  /** Messages already on screen when the panel mounted -- a transcript restored
   *  from storage after a reload. Only a reply that arrives after them is new,
   *  so only that one is revealed word by word. */
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
    <section className="panel chat" aria-labelledby="chat-title">
      <h2 id="chat-title">Plan together</h2>
      <div className="chat__stream" ref={stream} aria-busy={busy}>
        {!plan && !messages.length && (
          <div className="chat-empty">
            <h3>Where to next?</h3>
            <p>
              Describe your destination, travel dates, number of travellers and total budget, or add
              them in the bar at the top.
            </p>
            <div className="chat-empty__suggestions" aria-label="Example trips">
              {prompts.map(({ label, text }) => (
                <button
                  key={label}
                  type="button"
                  title={text}
                  disabled={busy}
                  onClick={() => onSend(text)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="chat-empty__input-hint">
              Pick an example to plan it now, or write your own below.
            </p>
            {onStart && (
              <button type="button" onClick={onStart}>
                Add trip details
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
            aria-label="Thinking process"
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
            onSend();
          }}
        >
          <Composer
            value={input}
            placeholder={
              plan ? "Tell me what to change…" : "Destination, dates, travellers and budget…"
            }
            busy={busy}
            canSend={Boolean(input.trim()) || Boolean(attachments?.length)}
            canCancel={Boolean(onCancel)}
            inputRef={inputRef}
            onInput={onInput}
            onSend={onSend}
            {...(onCancel ? { onCancel } : {})}
            {...(onAttachFiles ? { onAttachFiles } : {})}
            {...(attachments ? { attachments } : {})}
            {...(onRemoveAttachment ? { onRemoveAttachment } : {})}
            {...(canAttach === undefined ? {} : { canAttach })}
            {...(attachNotice ? { attachNotice } : {})}
          />
        </form>
      )}
      <p className="disclaimer">Estimates require verification. Nothing here makes a booking.</p>
    </section>
  );
}
