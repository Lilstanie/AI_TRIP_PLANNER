"use client";
import { useMemo } from "react";
import type { AgentProgressEvent } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { AssistantIcon } from "./assistants";
import { useAssistantName } from "./assistant-names";
import { teamSummary } from "./team-model";
import { useTeamRun } from "./team-run";

export function TeamSummary({
  activity,
  index,
  turn,
}: {
  activity: readonly AgentProgressEvent[];
  index: number;
  turn: number;
}) {
  const { t } = useLocale();
  const name = useAssistantName();
  const { show } = useTeamRun();
  const summary = useMemo(() => teamSummary(activity), [activity]);
  if (!summary) return null;
  const [only] = summary.specialists;
  const who =
    summary.specialists.length === 1 && only
      ? t("{name} specialist", { name: name(only) })
      : t("Coordinator + {count} specialists", { count: summary.specialists.length });
  const rounds = t(summary.rounds === 1 ? "1 round" : "{count} rounds", {
    count: summary.rounds,
  });
  const text = `${who} · ${rounds}`;
  return (
    <button
      type="button"
      className="team-summary"
      aria-label={t("{summary}, view assignments", { summary: text })}
      aria-haspopup="dialog"
      onClick={() => show({ index, turn, activity })}
    >
      <span className="team-summary__avatars" aria-hidden="true">
        {summary.assistants.map((assistant) => (
          <AssistantIcon key={assistant} id={assistant} />
        ))}
      </span>
      <span className="team-summary__text">{text}</span>
    </button>
  );
}
