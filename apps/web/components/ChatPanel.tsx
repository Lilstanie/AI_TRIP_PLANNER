"use client";

import { useEffect, useRef, useState } from "react";
import { AGENT_NAMES, type AgentName, type AgentProgressEvent, type TripPlan } from "@trip/shared";
import { useLanguage } from "@/components/LanguageContext";
import { requestTripUpdate } from "@/lib/chatStream";

type Message = { id: string; role: "user" | "agent"; text: string };
type Activity = {
  agent: AgentName;
  status: "queued" | "running" | "completed" | "failed";
  round?: number;
  error?: string;
};

const AGENT_LABELS: Record<AgentName, string> = {
  itinerary: "Day plan",
  transport: "Getting around",
  accommodation: "Stay",
  "destination-guide": "Destination guide",
  dining: "Food & dining",
};

export function ChatPanel({
  plan,
  onPlan,
  inputRef,
  onOpenFilters,
}: {
  plan: TripPlan;
  onPlan: (plan: TripPlan) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  onOpenFilters: () => void;
}) {
  const { language, t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);
  const streamRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController>(null);

  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activity]);
  useEffect(() => () => abortRef.current?.abort(), []);

  function updateProgress(event: AgentProgressEvent) {
    setActivity((current) =>
      current.map((item) =>
        item.agent === event.agent
          ? {
              ...item,
              status:
                event.type === "agent_started"
                  ? "running"
                  : event.type === "agent_completed"
                    ? "completed"
                    : "failed",
              round: event.round,
              error: event.type === "agent_failed" ? event.error : undefined,
            }
          : item,
      ),
    );
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);
    setInput("");
    setBusy(true);
    setActivity(AGENT_NAMES.map((agent) => ({ agent, status: "queued" })));
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await requestTripUpdate({
        tripId: plan.tripId,
        message: text,
        brief: plan.brief,
        signal: controller.signal,
        onProgress: updateProgress,
      });
      onPlan(response.plan);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "agent", text: response.reply },
      ]);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: cause instanceof Error ? cause.message : "Unable to update this trip.",
        },
      ]);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  }

  const completed = plan.sections.filter((section) => section.status === "confirmed").length;
  const displayedActivity: Activity[] = activity.length
    ? activity
    : AGENT_NAMES.map((agent) => ({ agent, status: "queued" }));

  return (
    <section className="panel chat" aria-label="Conversation with trip coordinator">
      <header className="chat-heading">
        <div>
          <span className="eyebrow">{t("Coordinator")}</span>
          <h1>{t("Build your trip together")}</h1>
          <p>{t("One conversation, with specialists working behind the scenes.")}</p>
        </div>
        <span className="decision-count">
          {language === "zh"
            ? `${completed}/${plan.sections.length} 项已确认`
            : `${completed}/${plan.sections.length} confirmed`}
        </span>
      </header>

      <div className="agent-progress" aria-live="polite" aria-busy={busy}>
        {displayedActivity.map((item) => (
          <div key={item.agent}>
            <span className={`status-dot status-dot--${item.status}`} />
            <span>{t(AGENT_LABELS[item.agent])}</span>
            <small>
              {t(
                item.status === "queued"
                  ? "Queued"
                  : item.status === "running"
                    ? "Running"
                    : item.status === "completed"
                      ? "Complete"
                      : "Needs attention",
              )}
              {item.round && item.round > 1 ? ` · ${item.round}` : ""}
            </small>
            {item.error && <small className="agent-progress__error">{item.error}</small>}
          </div>
        ))}
      </div>

      <div className="chat__stream" ref={streamRef}>
        <div className="coordinator-message">
          <span className="avatar">AI</span>
          <div>
            <strong>
              {t("Tell me what to change, and I’ll ask the specialist agents to rebuild the plan.")}
            </strong>
            <p>
              {plan.brief.destination} · {plan.brief.dates[0]} – {plan.brief.dates[1]} · USD{" "}
              {plan.brief.budgetTotal.toLocaleString()}
            </p>
            <button type="button" className="secondary-button" onClick={onOpenFilters}>
              {t("Trip filters")}
            </button>
          </div>
        </div>

        {plan.hitl
          .filter((checkpoint) => checkpoint.status === "pending")
          .map((checkpoint) => (
            <article className="decision-card" key={checkpoint.id}>
              <div className="card-kicker">Human in the loop</div>
              <h2>{checkpoint.title}</h2>
              <p>{checkpoint.detail}</p>
              <span className="pending-contract-note">
                {language === "zh"
                  ? "当前 main 分支尚未接回决策写入接口，请在对话中确认或修改。"
                  : "Decision persistence is not yet reconnected on main; confirm or revise this in chat."}
              </span>
            </article>
          ))}

        {messages.map((message) => (
          <div className={`msg msg--${message.role}`} key={message.id}>
            {message.text}
          </div>
        ))}
      </div>

      <form className="chat__form" onSubmit={send}>
        <input
          ref={inputRef}
          aria-label="Message the trip coordinator"
          placeholder={busy ? t("Planning your trip…") : t("Message the trip coordinator…")}
          value={input}
          disabled={busy}
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          {busy ? "…" : t("Send")}
        </button>
      </form>
      <p className="disclaimer">
        {t("AI-generated results may be inaccurate. Double-check important details.")}
      </p>
    </section>
  );
}
