"use client";
import { memo, useMemo } from "react";
import type { AgentProgressEvent } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { useSettings } from "@/components/account/SettingsProvider";
import { assistantName } from "@/components/chat/assistant-names";
import { buildTrajectory } from "@/lib/trajectory/adapter";
import type { Message } from "@/lib/workspace";
import { createTrajectoryTranslate } from "./locales";
import { TrajectoryView } from "./TrajectoryView";

export const TrajectoryTab = memo(function TrajectoryTab({
  messages,
  live,
  busy,
}: {
  messages: readonly Message[];
  live: readonly AgentProgressEvent[];
  busy: boolean;
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
      }),
    [messages, live, busy, t, tt, names, locale],
  );
  return <TrajectoryView t={tt} turns={ledger.turns} steps={ledger.steps} />;
});
