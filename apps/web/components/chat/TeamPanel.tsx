/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

"use client";
import { useLayoutEffect, useRef, useState } from "react";
import type { AssistantId } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { IconChevronDownOutlineRegular, StateDot, Tag } from "../trajectory/shim";
import type { StateDotState } from "../trajectory/shim";
import { AssistantIcon } from "./assistants";
import { useAssistantName } from "./assistant-names";
import { checkText } from "./team-check";
import {
  assignmentStatusLabels,
  rowStatusLabels,
  sourceLabels,
  type Assignment,
  type AssignmentStatus,
  type DecidedBy,
  type RowStatus,
  type TeamModel,
} from "./team-model";
import css from "./TeamPanel.module.css";

const ROW_DOTS: Record<RowStatus, StateDotState> = {
  idle: "idle",
  none: "idle",
  working: "ongoing",
  done: "done",
  failed: "error",
  needs_change: "warning",
  stopped: "warning",
};

const ASSIGNMENT_DOTS: Record<AssignmentStatus, StateDotState> = {
  working: "ongoing",
  done: "done",
  failed: "error",
  stopped: "warning",
};

const KIND_LABELS = {
  dispatch: "dispatch",
  revision: "revision",
  handoff: "handOff",
} as const;

function DecidedMarker({ decidedBy, className }: { decidedBy: DecidedBy; className?: string }) {
  const { t } = useLocale();
  return (
    <Tag
      tone={decidedBy === "llm" ? "info" : "outline"}
      className={`team-panel__marker team-panel__marker--${decidedBy}${className ? ` ${className}` : ""}`}
    >
      {t(decidedBy === "llm" ? "decidedByAi" : "decidedByCode")}
    </Tag>
  );
}

function Description({ text, error = false }: { text: string; error?: boolean }) {
  const { t } = useLocale();
  const node = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    const paragraph = node.current;
    if (expanded || !paragraph) return;
    const measure = () => setClamped(paragraph.scrollHeight > paragraph.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(paragraph);
    return () => observer.disconnect();
  }, [text, expanded]);
  const classes = [expanded ? undefined : css.clampedDescription, error ? css.error : undefined];
  return (
    <>
      <p ref={node} className={["team-panel__text", ...classes].filter(Boolean).join(" ")}>
        {text}
      </p>
      {(clamped || expanded) && (
        <button
          type="button"
          className={`team-panel__press ${css.expandToggle}`}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {t(expanded ? "showLess" : "showMore")}
          <IconChevronDownOutlineRegular
            size={12}
            {...(expanded ? { className: css.expandToggleOpen } : {})}
          />
        </button>
      )}
    </>
  );
}

function TaskCard({ entry }: { entry: Assignment }) {
  const { t } = useLocale();
  const name = useAssistantName();
  const text = entry.handoffTo
    ? t("thatIsNotMyArea", {
        name: name(entry.handoffTo),
      })
    : (entry.error ?? entry.objective);
  return (
    <article className={css.task}>
      <div className={css.taskTitle}>
        <AssistantIcon id={entry.owner} />
        <strong className="team-panel__owner">{name(entry.owner)}</strong>
        <span className={css.taskState}>
          <StateDot state={ASSIGNMENT_DOTS[entry.status]} />
          <span className="team-panel__status">{t(assignmentStatusLabels[entry.status])}</span>
        </span>
      </div>
      {text && <Description text={text} error={!entry.handoffTo && entry.error !== undefined} />}
      <div className={css.meta}>
        <span>{t(KIND_LABELS[entry.kind])}</span>
        {entry.decidedBy && <DecidedMarker decidedBy={entry.decidedBy} />}
        {entry.source && (
          <Tag tone="neutral" className="team-panel__source">
            {t(sourceLabels[entry.source])}
          </Tag>
        )}
      </div>
    </article>
  );
}

export function TeamPanel({
  model,
  onSelect,
}: {
  model: TeamModel;
  onSelect?: (assistant: AssistantId) => void;
}) {
  const { t } = useLocale();
  const name = useAssistantName();
  return (
    <section className={`team-panel ${css.panel}`} aria-label={t("specialistTeam")} tabIndex={-1}>
      <div className={css.body}>
        <section>
          <h3>
            {t("members")}
            <span className={css.count}>{model.rows.length}</span>
          </h3>
          <ul className={css.roster} aria-label={t("assistants")}>
            {model.rows.map((row) => {
              const pressable = Boolean(onSelect) && row.status !== "idle" && row.status !== "none";
              return (
                <li
                  key={row.assistant}
                  className={`team-panel__row ${css.item}`}
                  data-assistant={row.assistant}
                  data-status={row.status}
                >
                  <button
                    type="button"
                    className={`team-panel__press ${css.member}`}
                    disabled={!pressable}
                    {...(pressable
                      ? {
                          "aria-label": t("showNameTrajectory", { name: name(row.assistant) }),
                          onClick: () => onSelect?.(row.assistant),
                        }
                      : {})}
                  >
                    <AssistantIcon id={row.assistant} />
                    <span className={css.memberText}>
                      <span className={css.memberName}>
                        <span className={`team-panel__name ${css.memberNameText}`}>
                          {name(row.assistant)}
                        </span>
                      </span>
                      <small>
                        <StateDot
                          state={ROW_DOTS[row.status]}
                          size={row.status === "working" ? 11 : 8}
                        />{" "}
                        <span className="team-panel__status">{t(rowStatusLabels[row.status])}</span>
                      </small>
                      {row.decidedBy && (
                        <DecidedMarker decidedBy={row.decidedBy} className={css.rowTag} />
                      )}
                      {row.objective && (
                        <Tag tone="neutral" className={css.assignmentTag}>
                          {row.objective}
                        </Tag>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        {model.entries.length > 0 && (
          <section>
            <h3>
              {t("assignments")}
              <span className={css.count}>
                {model.entries.filter((entry) => entry.type === "assignment").length}
              </span>
            </h3>
            <ol className={css.tasks} aria-label={t("assignments")}>
              {model.entries.map((entry) =>
                entry.type === "check" ? (
                  <li key={entry.id} className="team-panel__check" data-check={entry.decision.type}>
                    <div className={css.check}>
                      <StateDot
                        state={
                          entry.decision.type === "conflicts_detected" &&
                          entry.decision.conflicts.length > 0
                            ? "warning"
                            : "idle"
                        }
                      />
                      <span>{checkText(t, name, entry.decision)}</span>
                      {entry.decision.type === "conflicts_detected" &&
                        entry.decision.conflicts.length > 0 && (
                          <Tag tone="warning">{t("needsChange")}</Tag>
                        )}
                    </div>
                  </li>
                ) : (
                  <li
                    key={entry.id}
                    className="team-panel__assignment"
                    data-assistant={entry.owner}
                    data-kind={entry.kind}
                    data-status={entry.status}
                  >
                    <TaskCard entry={entry} />
                  </li>
                ),
              )}
            </ol>
          </section>
        )}
      </div>
    </section>
  );
}
