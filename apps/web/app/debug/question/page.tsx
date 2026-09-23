"use client";
import { notFound } from "next/navigation";
import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { formatAskAnswers, type PendingAsk } from "@/lib/workspace/ask-user";
import type { Message } from "@/lib/workspace";

const ask: PendingAsk = {
  key: "debug-ask",
  known: { destination: "Kyoto", groupSize: 2 },
  questions: [
    {
      id: "pace",
      header: "Pace",
      question: "How busy should each day be?",
      detail: "Kyoto's temples open early; a slower pace leaves room for long lunches.",
      options: [
        { label: "Relaxed (Recommended)", description: "Two or three stops a day" },
        { label: "Balanced", description: "Three or four stops with a free evening" },
        { label: "Packed", description: "Five or more stops, early starts" },
      ],
    },
    {
      id: "food",
      header: "Food",
      question: "Which food experiences matter to you?",
      multiSelect: true,
      options: [
        { label: "Kaiseki dinner" },
        { label: "Nishiki market street food" },
        { label: "Specialty coffee" },
      ],
    },
    { id: "notes", header: "Anything else", question: "Anything we should plan around?" },
  ],
};

/**
 * Development surface for the structured-question card: the chat panel with a pending ask, so the
 * card can be checked in its composer seat without a provider call. Development-only.
 */
export default function DebugQuestionPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [pending, setPending] = useState<PendingAsk | undefined>(ask);
  const [messages, setMessages] = useState<Message[]>([
    { role: "user", text: "Plan four days in Kyoto for two, around AUD 4000.", at: Date.now() },
    { role: "agent", text: "Before I lay out the days, a few quick choices:", at: Date.now() },
  ]);
  const [input, setInput] = useState("");
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", height: "100dvh" }}>
      <ChatPanel
        messages={messages}
        input={input}
        onInput={setInput}
        busy={false}
        activity={[]}
        onSend={() => setPending(ask)}
        onEdit={() => {}}
        ask={pending}
        onAnswer={(answers) => {
          setMessages((current) => [
            ...current,
            { role: "user", text: formatAskAnswers(ask.questions, answers), at: Date.now() },
          ]);
          setPending(undefined);
        }}
        onDismissAsk={() => setPending(undefined)}
      />
    </div>
  );
}
