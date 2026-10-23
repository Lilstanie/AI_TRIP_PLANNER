"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AgentProgressEvent, AssistantId } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { AssistantIcon } from "./assistants";
import { useAssistantName } from "./assistant-names";
import { checkText } from "./team-check";
import {
  assignmentStatusLabels,
  rowStatusLabels,
  sourceLabels,
  teamModel,
  type TeamModel,
} from "./team-model";

function Objective({ text }: { text: string }) {
  const { t } = useLocale();
  const node = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    const element = node.current;
    if (element && !expanded) setClamped(element.scrollHeight > element.clientHeight + 1);
  }, [text, expanded]);
  return (
    <>
      <p ref={node} className="team-panel__objective" data-expanded={expanded || undefined}>
        {text}
      </p>
      {(clamped || expanded) && (
        <button
          type="button"
          className="team-panel__more"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {t(expanded ? "Show less" : "Show more")}
        </button>
      )}
    </>
  );
}

export function TeamPanel({
  activity,
  settled,
  model,
  onSelect,
}: {
  activity: readonly AgentProgressEvent[];
  settled: boolean;
  model?: TeamModel;
  onSelect?: (assistant: AssistantId) => void;
}) {
  const { t } = useLocale();
  const name = useAssistantName();
  const derived = useMemo(() => model ?? teamModel(activity, settled), [model, activity, settled]);
  return (
    <section className="team-panel" aria-label={t("Specialist team")} tabIndex={-1}>
      <ul className="team-panel__rows" aria-label={t("Assistants")}>
        {derived.rows.map((row) => (
          <li
            key={row.assistant}
            className="team-panel__row"
            data-assistant={row.assistant}
            data-status={row.status}
          >
            <AssistantIcon id={row.assistant} />
            <div className="team-panel__main">
              <div className="team-panel__head">
                <strong className="team-panel__name">
                  {onSelect && row.status !== "idle" && row.status !== "none" ? (
                    <button
                      type="button"
                      className="team-panel__press"
                      aria-label={t("Show {name} thinking", { name: name(row.assistant) })}
                      onClick={() => onSelect(row.assistant)}
                    >
                      {name(row.assistant)}
                    </button>
                  ) : (
                    name(row.assistant)
                  )}
                </strong>
                <span className="team-panel__status">{t(rowStatusLabels[row.status])}</span>
                {row.decidedBy && (
                  <span
                    className={`team-panel__chip team-panel__marker team-panel__marker--${row.decidedBy}`}
                  >
                    {t(row.decidedBy === "llm" ? "Decided by AI" : "Decided by code")}
                  </span>
                )}
              </div>
              {row.objective && <Objective text={row.objective} />}
            </div>
          </li>
        ))}
      </ul>
      {derived.entries.length > 0 && (
        <ol className="team-panel__entries" aria-label={t("Assignments")}>
          {derived.entries.map((entry) =>
            entry.type === "check" ? (
              <li key={entry.id} className="team-panel__check" data-check={entry.decision.type}>
                {checkText(t, name, entry.decision)}
                {entry.decision.type === "conflicts_detected" &&
                  entry.decision.conflicts.length > 0 && (
                    <span className="team-panel__chip team-panel__chip--attention">
                      {t("Needs change")}
                    </span>
                  )}
              </li>
            ) : (
              <li
                key={entry.id}
                className="team-panel__assignment"
                data-assistant={entry.owner}
                data-kind={entry.kind}
                data-status={entry.status}
              >
                <AssistantIcon id={entry.owner} />
                <div className="team-panel__main">
                  <div className="team-panel__head">
                    <strong className="team-panel__owner">{name(entry.owner)}</strong>
                    <span className="team-panel__status">
                      {t(assignmentStatusLabels[entry.status])}
                    </span>
                    {entry.decidedBy && (
                      <span
                        className={`team-panel__chip team-panel__marker team-panel__marker--${entry.decidedBy}`}
                      >
                        {t(entry.decidedBy === "llm" ? "Decided by AI" : "Decided by code")}
                      </span>
                    )}
                    {entry.source && (
                      <span className="team-panel__chip team-panel__source">
                        {t(sourceLabels[entry.source])}
                      </span>
                    )}
                  </div>
                  {entry.handoffTo ? (
                    <p className="team-panel__text">
                      {t("That is not my area. The {name} specialist should handle this.", {
                        name: name(entry.handoffTo),
                      })}
                    </p>
                  ) : entry.error ? (
                    <p className="team-panel__text team-panel__text--error">{entry.error}</p>
                  ) : (
                    entry.objective && <Objective text={entry.objective} />
                  )}
                </div>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}
