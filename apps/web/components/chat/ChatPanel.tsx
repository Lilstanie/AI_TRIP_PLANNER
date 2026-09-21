"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { AGENT_NAMES, type AgentProgressEvent, type TripPlan } from "@trip/shared";
import { looksLikeDateQuestion } from "@/lib/planning/date-range";
import { quickPrompts } from "@/lib/planning/quick-prompts";
import type { Message } from "@/lib/workspace";
import { CalendarIcon } from "../ui/icons";
import { CheckpointCards, type Decision } from "../trip/CheckpointCards";

// react-day-picker + its stylesheet are only worth loading once the
// traveller actually opens the calendar, not on every chat load.
const DateRangePicker = dynamic(
  () => import("../preferences/DateRangePicker").then((m) => m.DateRangePicker),
  { ssr: false },
);
const labels = {
  itinerary: "Day plan",
  transport: "Getting around",
  accommodation: "Stay",
  "destination-guide": "Destination guide",
  dining: "Food & dining",
};

type ActivityStatus =
  "queued" | "running" | "revising" | "completed" | "failed" | "interrupted" | "unknown";
const progressSteps = ["Submitting", "Thinking", "Calling tools", "Drafting answer", "Complete"];
const statusLabels: Record<ActivityStatus, string> = {
  queued: "Queued",
  running: "Running",
  revising: "Revising",
  completed: "Complete",
  failed: "Needs attention",
  interrupted: "Interrupted",
  unknown: "Unknown status",
};
const statusSymbols: Record<ActivityStatus, string> = {
  queued: "○",
  running: "↻",
  revising: "↻",
  completed: "✓",
  failed: "!",
  interrupted: "■",
  unknown: "?",
};

function agentStatus(event: AgentProgressEvent | undefined, busy: boolean): ActivityStatus {
  if (!event) return busy ? "queued" : "interrupted";
  if (event.type === "agent_failed") return "failed";
  if (event.type === "agent_completed") return "completed";
  if (event.type === "agent_started") return event.round > 1 ? "revising" : "running";
  return "unknown";
}

function progressStep(activity: AgentProgressEvent[], busy: boolean, error?: string): number {
  if (error && !busy) return -1;
  if (!busy) return activity.length ? progressSteps.length - 1 : 0;
  const started = activity.some((event) => event.type === "agent_started");
  if (!started) return 0;
  const completed = activity.filter((event) => event.type === "agent_completed").length;
  return completed === 0 ? 1 : completed >= AGENT_NAMES.length ? 3 : 2;
}

function currentAgent(activity: AgentProgressEvent[]): string | undefined {
  const lastStarted = [...activity].reverse().find((event) => event.type === "agent_started");
  if (!lastStarted || lastStarted.type !== "agent_started") return undefined;
  const completedAfter = activity.some(
    (event) =>
      event.type === "agent_completed" &&
      event.agent === lastStarted.agent &&
      event.round === lastStarted.round,
  );
  return completedAfter ? undefined : labels[lastStarted.agent];
}
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
  /** Optional text sends that message instead of the composer's contents. */
  onSend: (message?: string) => void;
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

  const prompts = useMemo(() => quickPrompts(), []);
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
            </div>
          ))}
        </div>
        {activity.length > 0 && (
          <section className="agent-activity" aria-label="Planning progress">
            {(() => {
              const activeStep = progressStep(activity, busy, error);
              const activeAgent = currentAgent(activity);
              return (
                <div className="ai-progress" aria-live="polite">
                  <div className="ai-progress__head">
                    <div>
                      <span className="ai-progress__eyebrow">Trip planner</span>
                      <strong>
                        {activeStep < 0
                          ? "Planning needs attention"
                          : progressSteps[activeStep] ?? "Planning"}
                      </strong>
                    </div>
                    <span className="ai-progress__count">
                      {activeStep < 0
                        ? "Retry available"
                        : `${Math.max(activeStep, 0) + 1}/${progressSteps.length}`}
                    </span>
                  </div>
                  <div className="ai-progress__track" aria-hidden="true">
                    <span
                      className={`ai-progress__fill${activeStep < 0 ? " ai-progress__fill--error" : ""}`}
                      style={{
                        width: `${activeStep < 0 ? 100 : ((activeStep + 1) / progressSteps.length) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="ai-progress__steps" role="list" aria-label="Planning stages">
                    {progressSteps.map((step, index) => {
                      const state =
                        activeStep < 0
                          ? index === 0
                            ? "error"
                            : "pending"
                          : index < activeStep
                            ? "complete"
                            : index === activeStep
                              ? "active"
                              : "pending";
                      return (
                        <span
                          className={`ai-progress__step ai-progress__step--${state}`}
                          data-state={state}
                          key={step}
                          role="listitem"
                        >
                          <span aria-hidden="true">{state === "complete" ? "✓" : index + 1}</span>
                          {step}
                        </span>
                      );
                    })}
                  </div>
                  {activeAgent && (
                    <p className="ai-progress__current">
                      Working on <strong>{activeAgent}</strong> with structured trip evidence.
                    </p>
                  )}
                  {busy && (
                    <div className="ai-progress__answer" aria-label="Answer in progress">
                      <span className="ai-progress__spark" aria-hidden="true" />
                      <span>Building a grounded answer from the completed checks…</span>
                    </div>
                  )}
                </div>
              );
            })()}
            <h3 className="agent-activity__title">Planning progress</h3>
            <div className="agent-activity__list" role="list">
              <div
                className="agent-activity__row"
                role="listitem"
                aria-label={`Coordinator ${busy ? "Running" : "Complete"}`}
              >
                <span>Coordinator</span>
                <span
                  className={`agent-activity__status agent-activity__status--${busy ? "running" : "completed"}`}
                >
                  <span className="agent-activity__indicator" aria-hidden="true">
                    {statusSymbols[busy ? "running" : "completed"]}
                  </span>
                  {busy ? "Running" : "Complete"}
                </span>
              </div>
              {AGENT_NAMES.map((agent) => {
                const events = activity.filter((e) => "agent" in e && e.agent === agent);
                const status = agentStatus(events.at(-1), busy);
                return (
                  <div
                    className="agent-activity__row"
                    key={agent}
                    role="listitem"
                    aria-label={`${labels[agent]} ${statusLabels[status]}`}
                  >
                    <span>{labels[agent]}</span>
                    <span className={`agent-activity__status agent-activity__status--${status}`}>
                      <span className="agent-activity__indicator" aria-hidden="true">
                        {statusSymbols[status]}
                      </span>
                      {statusLabels[status]}
                    </span>
                    <details aria-label={`${labels[agent]} details`}>
                      <summary>View details</summary>
                      {events.length ? (
                        events.map((event, i) => (
                          <div key={i}>
                            <strong>Round {event.round}</strong>
                            {"summary" in event && <p>{event.summary}</p>}
                            {"constraints" in event && event.constraints?.length ? (
                              <ul>
                                {event.constraints.map((c, j) => (
                                  <li key={j}>{c}</li>
                                ))}
                              </ul>
                            ) : null}
                            {event.type === "agent_failed" && (
                              <p className="error-text">{event.error}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p>Waiting for assignment.</p>
                      )}
                    </details>
                  </div>
                );
              })}
            </div>
            <details aria-label="Coordinator details">
              <summary>Coordinator details</summary>
              {activity
                .filter((e) => e.type === "coordinator")
                .map(
                  (event, i) =>
                    event.type === "coordinator" && (
                      <div key={i}>
                        <strong>
                          {event.phase} · round {event.round}
                        </strong>
                        <p>{event.summary}</p>
                        {event.constraints?.length ? (
                          <ul>
                            {event.constraints.map((c, j) => (
                              <li key={j}>{c}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ),
                )}
            </details>
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
