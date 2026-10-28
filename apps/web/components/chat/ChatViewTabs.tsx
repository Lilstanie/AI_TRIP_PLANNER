"use client";
import { useLocale } from "../account/LocaleProvider";

import type { ChatView } from "@/lib/workspace/layout";

export type { ChatView };

export function ChatViewTabs({
  view,
  onChoose,
  className = "chat__tabs",
}: {
  view: ChatView;
  onChoose: (next: ChatView) => void;
  className?: string;
}) {
  const { t } = useLocale();
  return (
    <div className={className} role="tablist" aria-label={t("Chat view")}>
      {(["conversation", "trajectory"] as const).map((id) => (
        <button
          key={id}
          type="button"
          className="chat__tab"
          role="tab"
          id={`chat-tab-${id}`}
          aria-controls={`chat-panel-${id}`}
          aria-selected={view === id}
          tabIndex={view === id ? 0 : -1}
          onClick={() => onChoose(id)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            const next = id === "conversation" ? "trajectory" : "conversation";
            onChoose(next);
            document.getElementById(`chat-tab-${next}`)?.focus();
          }}
        >
          {t(id === "conversation" ? "Conversation" : "Trajectory")}
        </button>
      ))}
    </div>
  );
}
