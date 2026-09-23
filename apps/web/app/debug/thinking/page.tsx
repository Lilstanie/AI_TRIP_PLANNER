"use client";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { ThinkingProcess } from "@/components/chat/ThinkingProcess";
import { thinkingFixture, thinkingFixtureRunning } from "@/lib/dev/thinking-fixtures";

type Mode = "settled" | "running" | "replay";

const REPLAY_STEP_MS = 450;

/**
 * Development surface for the thinking transcript.
 *
 * It renders the same components the chat does, against a recorded fixture, so
 * the layout, the fold and the expanded rows can be checked in a browser without
 * a provider call. "Replay" streams the mid-flight fixture one frame at a time,
 * so the Think summaries can be watched advancing. It is development-only, and
 * the transcript document records how to use it.
 */
export default function DebugThinkingPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [mode, setMode] = useState<Mode>("settled");
  const [frames, setFrames] = useState(0);

  useEffect(() => {
    if (mode !== "replay") return;
    setFrames(0);
    const timer = setInterval(() => {
      setFrames((count) => Math.min(count + 1, thinkingFixtureRunning.length));
    }, REPLAY_STEP_MS);
    return () => clearInterval(timer);
  }, [mode]);

  const activity =
    mode === "settled"
      ? thinkingFixture
      : mode === "running"
        ? thinkingFixtureRunning
        : thinkingFixtureRunning.slice(0, frames);
  const busy = mode !== "settled";
  return (
    <main className="chat">
      <h1>Thinking transcript</h1>
      <div role="group" aria-label="Fixture">
        {(["settled", "running", "replay"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {value === "settled" ? "Settled" : value === "running" ? "Mid-flight" : "Replay"}
          </button>
        ))}
      </div>
      <section className="agent-activity" aria-label="Thinking process">
        <ThinkingProcess activity={activity} busy={busy} />
      </section>
    </main>
  );
}
