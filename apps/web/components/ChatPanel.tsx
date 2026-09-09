"use client";

// Owner: E (shell) + A (wire to real orchestrator chat parsing).
// Posts a ChatRequest to /api/chat and lifts the returned plan up to Workspace.
import { useState } from "react";
import type {
  AgentRunTelemetry,
  ChatRunProgress,
  ChatTurn,
  TripIntakeDraft,
  TripIntakeResponse,
  TripPlan,
} from "@trip/shared";
import { readChatStream } from "@/lib/chatStream";

type Msg = { role: "user" | "agent"; text: string };
type RunView = {
  phase: ChatRunProgress["phase"];
  message: string;
  agents: Record<string, AgentRunTelemetry>;
  steps: Array<{ phase: ChatRunProgress["phase"]; message: string }>;
};

export function ChatPanel({
  plan,
  initialTripId,
  initialTurns = [],
  onPlan,
}: {
  plan: TripPlan | null;
  initialTripId?: string;
  initialTurns?: ChatTurn[];
  onPlan: (plan: TripPlan) => void;
}) {
  const brief = plan?.brief;
  const [tripId, setTripId] = useState(initialTripId ?? plan?.tripId);
  const [intake, setIntake] = useState<TripIntakeDraft>();
  const [messages, setMessages] = useState<Msg[]>(() =>
    initialTurns.map((turn) => ({
      role: turn.role === "assistant" ? "agent" : "user",
      text: turn.content,
    })),
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState<string>();
  const [decisionError, setDecisionError] = useState<Record<string, string>>({});
  const [run, setRun] = useState<RunView>();

  function showProgress(progress: ChatRunProgress) {
    setRun((current) => {
      const steps = current?.steps ?? [];
      const recordStep = !progress.agent || progress.agent.id === "coordinator";
      const duplicate = steps.at(-1)?.message === progress.message;
      return {
        phase: progress.phase,
        message: progress.message,
        agents: progress.agent
          ? { ...(current?.agents ?? {}), [progress.agent.id]: progress.agent }
          : (current?.agents ?? {}),
        steps:
          recordStep && !duplicate
            ? [...steps, { phase: progress.phase, message: progress.message }]
            : steps,
      };
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const requestTripId = tripId ?? crypto.randomUUID();
    if (!tripId) setTripId(requestTripId);
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");

    if (!plan) {
      setBusy(true);
      try {
        const response = await fetch("/api/chat/intake", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tripId: requestTripId,
            message: text,
            ...(intake ? { draft: intake } : {}),
            history: messages.map((message) => ({
              role: message.role === "agent" ? "assistant" : "user",
              content: message.text,
            })),
          }),
        });
        const data = (await response.json()) as TripIntakeResponse & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to understand this trip request.");
        setIntake(data.draft);
        setMessages((m) => [...m, { role: "agent", text: data.reply }]);
        if (data.ready && data.plan) {
          setTripId(data.plan.tripId);
          onPlan(data.plan);
        }
      } catch (cause) {
        setMessages((m) => [
          ...m,
          {
            role: "agent",
            text: cause instanceof Error ? cause.message : "Unable to understand this trip request.",
          },
        ]);
      } finally {
        setBusy(false);
      }
      return;
    }

    setRun({
      phase: "decomposing",
      message: "Starting the planning run",
      agents: {},
      steps: [{ phase: "decomposing", message: "Starting the planning run" }],
    });
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/x-ndjson" },
        body: JSON.stringify({
          tripId: requestTripId,
          message: text,
          ...(brief ? { brief } : {}),
        }),
      });
      const data = await readChatStream(res, showProgress);
      setTripId(data.plan.tripId);
      onPlan(data.plan);
      setMessages((m) => [...m, { role: "agent", text: data.reply }]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Request failed.";
      setRun((current) => ({
        phase: "complete",
        message: `Planning stopped: ${message}`,
        agents: current?.agents ?? {},
        steps: [
          ...(current?.steps ?? []),
          { phase: "complete", message: `Planning stopped: ${message}` },
        ],
      }));
      setMessages((m) => [...m, { role: "agent", text: message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`panel chat ${plan ? "" : "chat--welcome"} ${!plan && messages.length === 0 ? "chat--empty" : ""}`}
    >
      {plan && <h2>AI Trip Planner · Agent</h2>}
      <div className="chat__stream">
        {!plan && messages.length === 0 && (
          <div className="welcome-copy">
            <span>AI TRIP PLANNER</span>
            <h1>Where do you want to go?</h1>
            <p>
              Tell me your destination, dates, group size, and budget. I&apos;ll ask for any missing
              details before building your trip.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg msg--${m.role === "user" ? "user" : "agent"}`}>
            {m.text}
          </div>
        ))}
        {run && <RunTelemetry run={run} busy={busy} />}
        {(plan?.hitl ?? [])
          .filter((checkpoint) => checkpoint.status === "pending")
          .map((checkpoint) => (
            <div
              className="hitl-card"
              id={`hitl-${checkpoint.id}`}
              data-hitl-pending
              tabIndex={-1}
              key={checkpoint.id}
              aria-busy={decisionBusy === checkpoint.id}
            >
              <strong>{checkpoint.title}</strong>
              <span>{checkpoint.detail}</span>
              {decisionError[checkpoint.id] && (
                <span className="hitl-card__error" role="alert">
                  {decisionError[checkpoint.id]}
                </span>
              )}
              <div className="hitl-card__actions">
                <button
                  type="button"
                  disabled={Boolean(decisionBusy)}
                  onClick={() => decide(checkpoint.id, "approved")}
                >
                  {decisionBusy === checkpoint.id ? "Saving…" : "Approve"}
                </button>
                <button
                  type="button"
                  className="button--quiet"
                  disabled={Boolean(decisionBusy)}
                  onClick={() => decide(checkpoint.id, "rejected")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
      </div>
      <form className="chat__form" onSubmit={send}>
        <input
          className="field"
          style={{ marginBottom: 0 }}
          placeholder="Message AI Trip Planner…"
          aria-label={plan ? "Message AI Trip Planner" : "Describe your next trip"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={busy} aria-label="Send message">
          {busy ? "…" : "Send"}
        </button>
      </form>
      <p className="disclaimer">
        AI-generated results may be inaccurate. Double-check important details.
      </p>
    </section>
  );

  async function decide(checkpointId: string, status: "approved" | "rejected") {
    if (decisionBusy || !plan || !brief) return;
    setDecisionBusy(checkpointId);
    setDecisionError((current) => ({ ...current, [checkpointId]: "" }));
    try {
      const response = await fetch("/api/hitl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripId: brief.tripId,
          checkpointId,
          planVersion: plan.planVersion,
          status,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to save this decision.");
      onPlan({
        ...plan,
        hitl: plan.hitl.map((checkpoint) =>
          checkpoint.id === checkpointId ? { ...checkpoint, status } : checkpoint,
        ),
      });
      setMessages((current) => [
        ...current,
        {
          role: "agent",
          text: `${status === "approved" ? "Approved" : "Rejected"} for plan ${plan.planVersion.slice(0, 8)}.`,
        },
      ]);
    } catch (cause) {
      setDecisionError((current) => ({
        ...current,
        [checkpointId]: cause instanceof Error ? cause.message : "Unable to save this decision.",
      }));
    } finally {
      setDecisionBusy(undefined);
    }
  }
}

function RunTelemetry({ run, busy }: { run: RunView; busy: boolean }) {
  const agents = Object.values(run.agents);
  const hasUnavailableUsage = agents.some((agent) => agent.usage === null);
  const knownTokens = agents.reduce((total, agent) => total + (agent.usage?.totalTokens ?? 0), 0);

  return (
    <details className="run-telemetry" open={busy}>
      <summary>
        <span className={`run-dot ${busy ? "run-dot--active" : "run-dot--done"}`} />
        <strong>{busy ? "Planning in progress" : "Planning run"}</strong>
        <span>{run.phase}</span>
      </summary>
      <p className="run-telemetry__message">{run.message}</p>
      <ol className="run-telemetry__steps" aria-label="Planning stages">
        {run.steps.map((step, index) => (
          <li key={`${step.phase}-${index}`}>
            <span>{step.phase}</span>
            {step.message}
          </li>
        ))}
      </ol>
      <div className="run-telemetry__agents">
        {agents.map((agent) => (
          <div className="run-agent" key={agent.id}>
            <span className={`run-agent__status run-agent__status--${agent.status}`} aria-hidden />
            <span>
              <strong>{agent.label}</strong>
              <small>{agent.model}</small>
            </span>
            <span className="run-agent__meta">
              {agent.status}
              <small>
                {agent.usage === null
                  ? "Tokens unavailable"
                  : agent.usage.totalTokens === 0
                    ? "No LLM tokens"
                    : `${agent.usage.totalTokens.toLocaleString()} tokens`}
              </small>
            </span>
          </div>
        ))}
      </div>
      <p className="run-telemetry__usage">
        Token usage: {knownTokens.toLocaleString()} known
        {hasUnavailableUsage ? " · provider usage unavailable for model calls" : ""}
      </p>
    </details>
  );
}
