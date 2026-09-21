"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { type AgentProgressEvent, type TripPlan } from "@trip/shared";
import { looksLikeDateQuestion } from "@/lib/planning/date-range";
import type { Message } from "@/lib/workspace";
import { CalendarIcon } from "../ui/icons";
import { CheckpointCards, type Decision } from "../trip/CheckpointCards";
import { ThinkingProcess } from "./ThinkingProcess";

// react-day-picker + its stylesheet are only worth loading once the
// traveller actually opens the calendar, not on every chat load.
const DateRangePicker = dynamic(
  () => import("../preferences/DateRangePicker").then((m) => m.DateRangePicker),
  { ssr: false },
);
const suggestions = [
  "Plan a week in Paris with food, museums and day trips.",
  "Build a relaxed long weekend in Lisbon for two.",
  "Plan a family-friendly five days in Vancouver.",
  "Create a train-focused week through northern Italy.",
];

export function ChatPanel({
  plan,
  messages,
  input,
  onInput,
  busy,
  activity,
  onSend,
  onDecision,
  onEdit,
  onStart,
  onCancel,
  error,
}: {
  /** Undefined for a blank conversation that has not produced a plan. */
  plan?: TripPlan;
  messages: Message[];
  input: string;
  onInput: (value: string) => void;
  busy: boolean;
  activity: AgentProgressEvent[];
  onSend: () => void;
  onDecision: (decision: Decision) => void;
  onEdit: () => void;
  /** Opens Trip preferences from the blank-conversation prompt. */
  onStart?: () => void;
  /** Cancels the active request without changing the current plan. */
  onCancel?: () => void;
  /** High-level request error shown in the workspace. */
  error?: string;
}) {
  const stream = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (messages.length || activity.length)
      stream.current?.scrollTo({ top: stream.current.scrollHeight });
  }, [messages, activity]);

  const [showCalendar, setShowCalendar] = useState(false);
  // Auto-open once per new assistant message that reads as a date question —
  // track the message count we last reacted to so closing the dialog (or the
  // traveller typing instead) doesn't make it pop back open on every render.
  const autoOpenedFor = useRef(-1);
  useEffect(() => {
    const last = messages.at(-1);
    if (
      last?.role === "agent" &&
      looksLikeDateQuestion(last.text) &&
      autoOpenedFor.current !== messages.length
    ) {
      autoOpenedFor.current = messages.length;
      setShowCalendar(true);
    }
  }, [messages]);
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
            <div className="chat-empty__suggestions" aria-label="Example trip suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    onInput(suggestion);
                    inputRef.current?.focus();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <p className="chat-empty__input-hint">Choose a suggestion or write your own below.</p>
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
        {plan && (
          <CheckpointCards plan={plan} busy={busy} onDecision={onDecision} onEdit={onEdit} />
        )}
      </div>
      <form
        className="chat__form"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <button
          type="button"
          className="chat__calendar-trigger"
          aria-label="Pick travel dates from a calendar"
          disabled={busy}
          onClick={() => setShowCalendar(true)}
        >
          <CalendarIcon />
        </button>
        <input
          ref={inputRef}
          className="field"
          aria-label="Message AI Trip Planner"
          placeholder={
            plan ? "Tell me what to change…" : "Destination, dates, travellers and budget…"
          }
          value={input}
          disabled={busy}
          onChange={(e) => onInput(e.target.value)}
        />
        {busy ? (
          <button
            type="button"
            className="chat__stop"
            aria-label="Stop planning"
            disabled={!onCancel}
            onClick={onCancel}
          >
            Stop
          </button>
        ) : (
          <button className="primary" disabled={!input.trim()}>
            Send
          </button>
        )}
      </form>
      <p className="disclaimer">Estimates require verification. Nothing here makes a booking.</p>
      {showCalendar && (
        <DateRangePicker
          onConfirm={({ start, end }) => onInput(`Travel dates: ${start} to ${end}`)}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </section>
  );
}
