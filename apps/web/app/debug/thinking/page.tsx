"use client";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { LocaleProvider } from "@/components/account/LocaleProvider";
import { SettingsProvider } from "@/components/account/SettingsProvider";
import { ThinkingProcess } from "@/components/chat/ThinkingProcess";
import { thinkingFixture, thinkingFixtureRunning } from "@/lib/dev/thinking-fixtures";

type Mode = "settled" | "running" | "replay" | "failed";

const REPLAY_STEP_MS = 450;

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
  const busy = mode === "running" || mode === "replay";
  const error = mode === "failed" ? { raw: "Fixture failure" } : undefined;
  return (
    <SettingsProvider>
      <LocaleProvider>
        <main className="chat">
          <h1>Thinking transcript</h1>
          <div role="group" aria-label="Fixture">
            {(["settled", "running", "replay", "failed"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {value === "settled"
                  ? "Settled"
                  : value === "running"
                    ? "Mid-flight"
                    : value === "replay"
                      ? "Replay"
                      : "Failed"}
              </button>
            ))}
          </div>
          <section className="agent-activity" aria-label="Thinking process">
            <ThinkingProcess activity={activity} busy={busy} error={error} />
          </section>
        </main>
      </LocaleProvider>
    </SettingsProvider>
  );
}
