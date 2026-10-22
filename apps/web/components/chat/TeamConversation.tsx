"use client";
import { useMemo } from "react";
import type { AgentProgressEvent } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { AssistantIcon, ASSISTANT_ROLE_KEYS } from "./assistants";
import { sourceLabels, teamMessages } from "./team-model";

export function TeamConversation({ activity }: { activity: readonly AgentProgressEvent[] }) {
  const { t } = useLocale();
  const messages = useMemo(() => teamMessages(activity), [activity]);
  if (messages.length === 0) return null;
  return (
    <ol className="team-conversation" aria-label={t("Team conversation")}>
      {messages.map((message) => (
        <li
          key={message.id}
          className={`team-message team-message--${message.kind}`}
          data-assistant={message.assistant}
        >
          <AssistantIcon id={message.assistant} />
          <div className="team-message__main">
            <div className="team-message__head">
              <strong className="team-message__name">
                {t(ASSISTANT_ROLE_KEYS[message.assistant])}
              </strong>
              <span className={`team-message__marker team-message__marker--${message.decidedBy}`}>
                {t(message.decidedBy === "llm" ? "Decided by AI" : "Decided by code")}
              </span>
              {message.source && (
                <span className="team-message__source">{t(sourceLabels[message.source])}</span>
              )}
            </div>
            <p className="team-message__text">{message.text}</p>
            {message.objectives.length > 0 && (
              <ul className="team-message__objectives">
                {message.objectives.map((objective) => (
                  <li key={objective.agent}>
                    <strong>{t(ASSISTANT_ROLE_KEYS[objective.agent])}</strong> {objective.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
