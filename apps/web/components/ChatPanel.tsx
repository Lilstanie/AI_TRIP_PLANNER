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
      if (data.plan) onPlan(data.plan);
      setMessages((m) => [...m, { role: "agent", text: data.reply ?? data.error ?? "(no reply)" }]);
    } catch {
      setMessages((m) => [...m, { role: "agent", text: "Request failed." }]);
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
            <div className="hitl-card" key={checkpoint.id}>
              <strong>{checkpoint.title}</strong>
              <span>{checkpoint.detail}</span>
              <div className="hitl-card__actions">
                <button type="button" onClick={() => decide(checkpoint.id, "approved")}>
                  Approve
                </button>
                <button
                  type="button"
                  className="button--quiet"
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
    const response = await fetch("/api/hitl", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tripId: brief.tripId, checkpointId, status }),
    });
    if (!response.ok) return;
    onPlan({
      ...plan,
      hitl: plan.hitl.map((checkpoint) =>
        checkpoint.id === checkpointId ? { ...checkpoint, status } : checkpoint,
      ),
    });
  }
}
