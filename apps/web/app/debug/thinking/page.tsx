"use client";
import { notFound } from "next/navigation";
import { useState } from "react";
import { ThinkingProcess } from "@/components/chat/ThinkingProcess";
import { thinkingFixture, thinkingFixtureRunning } from "@/lib/dev/thinking-fixtures";

/**
 * Development surface for the thinking transcript.
 *
 * It renders the same components the chat does, against a recorded fixture, so
 * the layout, the fold and the expanded rows can be checked in a browser without
 * a provider call. It is development-only, and the transcript document records
 * how to use it.
 */
export default function DebugThinkingPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [running, setRunning] = useState(false);
  const activity = running ? thinkingFixtureRunning : thinkingFixture;
  const busy = running;
  return (
    <main className="chat">
      <h1>Thinking transcript</h1>
      <button type="button" onClick={() => setRunning((value) => !value)}>
        {running ? "Show settled" : "Show running"}
      </button>
      <section className="agent-activity" aria-label="Thinking process">
        <ThinkingProcess activity={activity} busy={busy} />
      </section>
    </main>
  );
}
