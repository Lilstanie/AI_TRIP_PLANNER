"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentProgressEvent } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { AssistantIcon } from "./assistants";
import { TeamPanel } from "./TeamPanel";
import { TeamRunBar } from "./TeamRunBar";
import { teamModel } from "./team-model";
import { useTeamRun } from "./team-run";

const HOVER_CLOSE_MS = 150;

export function TeamControl({
  activity,
  busy,
}: {
  activity: readonly AgentProgressEvent[];
  busy: boolean;
}) {
  const { t } = useLocale();
  const model = useMemo(() => teamModel(activity, !busy), [activity, busy]);
  const { run, request, showLatest } = useTeamRun();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const handled = useRef(request);
  useEffect(() => {
    if (handled.current === request) return;
    handled.current = request;
    setPinned(true);
  }, [request]);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const leaving = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const open = hovered || pinned;
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) showLatest();
    wasOpen.current = open;
  }, [open, showLatest]);

  const close = useCallback(() => {
    clearTimeout(leaving.current);
    setHovered(false);
    setPinned(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (root.current?.querySelector(".team-popover")?.contains(document.activeElement))
        button.current?.focus();
      close();
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  useEffect(() => () => clearTimeout(leaving.current), []);

  return (
    <div
      ref={root}
      className="team-control"
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        clearTimeout(leaving.current);
        setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "touch") return;
        leaving.current = setTimeout(() => setHovered(false), HOVER_CLOSE_MS);
      }}
    >
      <button
        ref={button}
        type="button"
        className="topbar-button team-trigger"
        aria-label={t("Specialist team")}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-working={model.working}
        onClick={() => setPinned(!pinned)}
      >
        <span className="team-trigger__avatars" aria-hidden="true">
          {model.rows.map((row) => (
            <AssistantIcon
              key={row.assistant}
              id={row.assistant}
              {...(row.status === "working" ? { className: "assistant-icon--working" } : {})}
            />
          ))}
        </span>
        <span className="team-trigger__label">{t("Specialist team")}</span>
        {model.working > 0 && (
          <span className="team-trigger__count">
            {t("{count} working", { count: model.working })}
          </span>
        )}
      </button>
      {open && (
        <div className="team-popover">
          <TeamRunBar />
          {run ? (
            <TeamPanel activity={run.activity} settled />
          ) : (
            <TeamPanel activity={activity} settled={!busy} model={model} />
          )}
        </div>
      )}
    </div>
  );
}
