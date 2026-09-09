"use client";

// Owner: E (shell) + A (wire to real orchestrator chat parsing).
// Posts a ChatRequest to /api/chat and lifts the returned plan up to Workspace.
import { useState } from "react";
import type { ChatResponse, TripPlan } from "@trip/shared";

type Msg = { role: "user" | "agent"; text: string };

const SEED: Msg[] = [
  {
    role: "agent",
    text: "Tell me what to change — for example: “Sydney, 2026-10-01 to 2026-10-05, 2 people, budget $3000.”",
  },
];

export function ChatPanel({ plan, onPlan }: { plan: TripPlan; onPlan: (plan: TripPlan) => void }) {
  const brief = plan.brief;
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState<string>();
  const [decisionError, setDecisionError] = useState<Record<string, string>>({});

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tripId: brief.tripId, message: text, brief }),
      });
      const data = (await res.json()) as Partial<ChatResponse> & { error?: string };
      if (!res.ok || !data.plan) throw new Error(data.error ?? "Unable to update this trip.");
      onPlan(data.plan);
      setMessages((m) => [...m, { role: "agent", text: data.reply ?? data.error ?? "(no reply)" }]);
    } catch (cause) {
      setMessages((m) => [
        ...m,
        { role: "agent", text: cause instanceof Error ? cause.message : "Request failed." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel chat">
      <h2>AI Trip Planner · Agent</h2>
      <div className="chat__stream">
        {messages.map((m, i) => (
          <div key={i} className={`msg msg--${m.role === "user" ? "user" : "agent"}`}>
            {m.text}
          </div>
        ))}
        {plan.hitl
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          {busy ? "…" : "Send"}
        </button>
      </form>
      <p className="disclaimer">
        AI-generated results may be inaccurate. Double-check important details.
      </p>
    </section>
  );

  async function decide(checkpointId: string, status: "approved" | "rejected") {
    if (decisionBusy) return;
    setDecisionBusy(checkpointId);
    setDecisionError((current) => ({ ...current, [checkpointId]: "" }));
    try {
      const response = await fetch("/api/hitl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tripId: brief.tripId, checkpointId, status }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to save this decision.");
      onPlan({
        ...plan,
        hitl: plan.hitl.map((checkpoint) =>
          checkpoint.id === checkpointId ? { ...checkpoint, status } : checkpoint,
        ),
      });
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
