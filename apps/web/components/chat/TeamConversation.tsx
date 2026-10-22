"use client";
import { useMemo } from "react";
import { formatMoney, type AgentProgressEvent } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { AssistantIcon, ASSISTANT_ROLE_KEYS } from "./assistants";
import { sourceLabels, teamMessages, type CheckMessage } from "./team-model";

const STOP_KEYS = {
  converged: "Stopped after round {round}: plan converged",
  round_limit: "Stopped after round {round}: round limit reached",
  infeasible_budget: "Stopped after round {round}: budget infeasible",
  no_improvement: "Stopped after round {round}: no improvement",
} as const;

function checkText(t: ReturnType<typeof useLocale>["t"], check: CheckMessage): string {
  const { decision } = check;
  const round = decision.round;
  if (decision.type === "loop_stopped") return t(STOP_KEYS[decision.reason], { round });
  if (decision.type === "revision_scored") {
    const key = decision.kept
      ? "Revision score, round {round}: {before} → {after}, revision kept"
      : "Revision score, round {round}: {before} → {after}, revision discarded";
    return t(key, {
      round,
      before: Math.round(decision.scoreBefore),
      after: Math.round(decision.scoreAfter),
    });
  }
  if (decision.conflicts.length === 0)
    return t("Conflict check, round {round}: no conflicts", { round });
  return decision.conflicts
    .map((conflict) => {
      const name = t(ASSISTANT_ROLE_KEYS[conflict.agent]);
      return conflict.targetSaving === undefined
        ? t("Conflict check, round {round}: {name} must change", { round, name })
        : t("Conflict check, round {round}: {name} should save {amount}", {
            round,
            name,
            amount: formatMoney(conflict.targetSaving, "AUD"),
          });
    })
    .join(" · ");
}

export function TeamConversation({ activity }: { activity: readonly AgentProgressEvent[] }) {
  const { t } = useLocale();
  const messages = useMemo(() => teamMessages(activity), [activity]);
  if (messages.length === 0) return null;
  return (
    <ol className="team-conversation" aria-label={t("Team conversation")}>
      {messages.map((message) =>
        message.kind === "check" ? (
          <li key={message.id} className="team-message team-message--check">
            <span className="team-message__text">{checkText(t, message)}</span>
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
        ),
      )}
    </ol>
  );
}
