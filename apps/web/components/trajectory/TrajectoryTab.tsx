"use client";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { AgentProgressEvent, AssistantId } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { useSettings } from "@/components/account/SettingsProvider";
import { AssistantIcon } from "@/components/chat/assistants";
import { assistantName } from "@/components/chat/assistant-names";
import { buildTrajectory } from "@/lib/trajectory/adapter";
import type { Message } from "@/lib/workspace";
import { createTrajectoryTranslate } from "./locales";
import { TrajectorySimple } from "./TrajectorySimple";
import { TrajectoryView } from "./TrajectoryView";
import css from "./simple.module.css";

type Mode = "simple" | "full";

export interface TurnJump {
  turn: number;
  nonce: number;
}

export const TrajectoryTab = memo(function TrajectoryTab({
  messages,
  live,
  busy,
  only,
  onClear,
  jump,
  onJumped,
  phone = false,
  onPlanInChat,
}: {
  messages: readonly Message[];
  live: readonly AgentProgressEvent[];
  busy: boolean;
  only: AssistantId | undefined;
  onClear: () => void;
  jump?: TurnJump;
  onJumped?: () => void;
  phone?: boolean;
  onPlanInChat?: () => void;
}) {
  const { t, locale } = useLocale();
  const { settings } = useSettings();
  const names = settings.assistant.names;
  const tt = useMemo(() => createTrajectoryTranslate(locale), [locale]);
  const [mode, setMode] = useState<Mode>("simple");
  const [selected, setSelected] = useState<number | undefined>();
  const [fullJump, setFullJump] = useState<TurnJump | undefined>();
  const nonce = useRef(0);
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
  const choose = useCallback(
    (next: Mode) => {
      if (next === "full" && selected !== undefined) {
        nonce.current += 1;
        setFullJump({ turn: selected, nonce: nonce.current });
      }
      setMode(next);
    },
    [selected],
  );
  const ownJumped = useCallback(() => {
    setFullJump(undefined);
    onJumped?.();
  }, [onJumped]);
  const name = useCallback((id: AssistantId) => assistantName(id, names, locale), [names, locale]);
  const empty = ledger.turns.length === 0;
  const shown: Mode = empty ? "full" : mode;
  const fullJumpNow = jump ?? fullJump;
  if (only === undefined && empty) {
    return (
      <div className="trajectory-tab">
        <div className="trajectory-empty">
          <p>{t("eachStepTheAssistantTakes")}</p>
          {onPlanInChat && (
            <button type="button" onClick={onPlanInChat}>
              {t("planInChat")}
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="trajectory-tab">
      {!empty && (
        <div
          className={`${css.modebar} glass-float`}
          data-trajectory-modebar=""
          data-phone={phone || undefined}
          role="group"
          aria-label={tt("view.aria")}
        >
          {(["simple", "full"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={css.mode}
              aria-pressed={shown === id}
              onClick={() => choose(id)}
            >
              {tt(id === "simple" ? "view.simple" : "view.full")}
            </button>
          ))}
        </div>
      )}
      {only !== undefined && (
        <div className="trajectory-filter" data-trajectory-filter={only}>
          <AssistantIcon id={only} />
          <strong>{assistantName(only, names, locale)}</strong>
          <button type="button" onClick={onClear}>
            {t("showAllRecords")}
          </button>
        </div>
      )}
      {shown === "simple" ? (
        <TrajectorySimple
          t={tt}
          turns={ledger.turns}
          displayName={name}
          selected={selected}
          onSelect={setSelected}
          jump={jump}
          onJumped={onJumped}
        />
      ) : (
        <TrajectoryView
          t={tt}
          turns={ledger.turns}
          steps={ledger.steps}
          phone={phone}
          {...(fullJumpNow ? { jump: fullJumpNow, onJumped: ownJumped } : {})}
        />
      )}
    </div>
  );
});
