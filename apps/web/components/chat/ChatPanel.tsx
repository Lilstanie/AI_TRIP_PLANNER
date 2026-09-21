"use client";
import { useEffect, useMemo, useRef } from "react";
import { type AgentProgressEvent, type TripPlan } from "@trip/shared";
import { quickPrompts } from "@/lib/planning/quick-prompts";
import type { Message } from "@/lib/workspace";
import { ThinkingProcess } from "./ThinkingProcess";
import { Composer } from "./Composer";
import { FlightResults } from "./FlightResults";

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
  /** Receives files picked from the composer's attach control. */
  onAttachFiles?: (files: File[]) => void;
}) {
  const stream = useRef<HTMLDivElement>(null);
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
              Describe your destination, travel dates, number of travellers and total budget, or
              fill in the preferences form.
            </p>
            <div className="chat-empty__suggestions" aria-label="Example trips">
              {prompts.map(({ label, text }) => (
                <button key={label} type="button" title={text} disabled={busy} onClick={() => onSend(text)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="chat-empty__input-hint">Pick an example to plan it now, or write your own below.</p>
            {onStart && (
              <button type="button" onClick={onStart}>
                Fill in trip preferences
              </button>
            )}
          </div>
        )}
        <div role="log" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`msg msg--${m.role}`}>
              <span className="msg__speaker">
                {m.role === "user" ? "You" : "Travel planning assistant"}
              </span>
              <div className="msg__content">{m.text}</div>
              {m.flights && <FlightResults answer={m.flights} />}
            </div>
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
          canSend={Boolean(input.trim())}
          canCancel={Boolean(onCancel)}
          hint={
            busy
              ? "Planning… the transcript above updates as each specialist works."
              : "Enter to send · Shift+Enter for a new line"
          }
          inputRef={inputRef}
          onInput={onInput}
          onSend={onSend}
          {...(onCancel ? { onCancel } : {})}
          {...(onAttachFiles ? { onAttachFiles } : {})}
        />
      </form>
      <p className="disclaimer">Estimates require verification. Nothing here makes a booking.</p>
    </section>
  );
}
