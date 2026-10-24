"use client";
import { memo, useMemo } from "react";
import type { AgentProgressEvent, AssistantId } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { useSettings } from "@/components/account/SettingsProvider";
import { AssistantIcon } from "@/components/chat/assistants";
import { assistantName } from "@/components/chat/assistant-names";
import { buildTrajectory } from "@/lib/trajectory/adapter";
import type { Message } from "@/lib/workspace";
import { createTrajectoryTranslate } from "./locales";
import { TrajectoryView } from "./TrajectoryView";

export const TrajectoryTab = memo(function TrajectoryTab({
  messages,
  live,
  busy,
  only,
  onClear,
  phone = false,
}: {
  messages: readonly Message[];
  live: readonly AgentProgressEvent[];
  busy: boolean;
  only: AssistantId | undefined;
  onClear: () => void;
  phone?: boolean;
}) {
  const { t, locale } = useLocale();
  const { settings } = useSettings();
  const names = settings.assistant.names;
  const tt = useMemo(() => createTrajectoryTranslate(locale), [locale]);
  const ledger = useMemo(
    () =>
      buildTrajectory({
        messages,
        live,
        busy,
        t,
        tt,
        displayName: (id) => assistantName(id, names, locale),
        only,
      }),
    [messages, live, busy, t, tt, names, locale, only],
  );
  return (
    <div className="trajectory-tab">
      {only !== undefined && (
        <div className="trajectory-filter" data-trajectory-filter={only}>
          <AssistantIcon id={only} />
          <strong>{assistantName(only, names, locale)}</strong>
          <button type="button" onClick={onClear}>
            {t("Show all records")}
          </button>
        </div>
      )}
      <TrajectoryView t={tt} turns={ledger.turns} steps={ledger.steps} phone={phone} />
    </div>
  );
});
