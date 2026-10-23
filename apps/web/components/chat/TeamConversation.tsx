"use client";
import { useMemo } from "react";
import type { AgentProgressEvent } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { AssistantIcon } from "./assistants";
import { useAssistantName } from "./assistant-names";
import { sourceLabels } from "./team-model";
import { teamMessages } from "./team-messages";
import { checkText } from "./team-check";

export function TeamConversation({
  activity,
  settled,
}: {
  activity: readonly AgentProgressEvent[];
  settled: boolean;
}) {
  const { t } = useLocale();
  const name = useAssistantName();
  const messages = useMemo(() => teamMessages(activity, settled), [activity, settled]);
  if (messages.length === 0) return null;
  return (
    <ol className="team-conversation" aria-label={t("Team conversation")}>
      {messages.map((message) =>
        message.kind === "check" ? (
          <li key={message.id} className="team-message team-message--check">
            <span className="team-message__text">{checkText(t, name, message.decision)}</span>
          </li>
        ) : (
          <li
            key={message.id}
            className={`team-message team-message--${message.kind}`}
            data-assistant={message.assistant}
          >
            <AssistantIcon id={message.assistant} />
            <div className="team-message__main">
              <div className="team-message__head">
                <strong className="team-message__name">{name(message.assistant)}</strong>
                {message.decidedBy && (
                  <span
                    className={`team-message__marker team-message__marker--${message.decidedBy}`}
                  >
                    {t(message.decidedBy === "llm" ? "Decided by AI" : "Decided by code")}
                  </span>
                )}
                {message.source && (
                  <span className="team-message__source">{t(sourceLabels[message.source])}</span>
                )}
              </div>
              <p className="team-message__text">
                {message.handoffTo
                  ? t("That is not my area. The {name} specialist should handle this.", {
                      name: name(message.handoffTo),
                    })
                  : message.text}
              </p>
              {message.objectives.length > 0 && (
                <ul className="team-message__objectives">
                  {message.objectives.map((objective) => (
                    <li key={objective.agent}>
                      <strong>{name(objective.agent)}</strong> {objective.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ),
      )}
    </ol>
  );
}
