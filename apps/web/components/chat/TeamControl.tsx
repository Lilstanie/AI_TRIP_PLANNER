"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "@/components/account/LocaleProvider";
import { AssistantIcon } from "./assistants";
import { TeamPanel } from "./TeamPanel";
import type { TeamModel, TeamTurn } from "./team-model";
import { useTeamSurface } from "./use-team-surface";

const HOVER_CLOSE_MS = 150;

export function TeamAvatars({ rows }: { rows: TeamModel["rows"] }) {
  return (
    <span className="team-trigger__avatars" aria-hidden="true">
      {rows.map((row) => (
        <AssistantIcon
          key={row.assistant}
          id={row.assistant}
          {...(row.status === "working" ? { className: "assistant-icon--working" } : {})}
        />
      ))}
    </span>
  );
}

export function TeamControl({ turn, onReveal }: { turn: TeamTurn; onReveal?: () => void }) {
  const { t } = useLocale();
  const popoverId = useId();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const leaving = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusIn = useRef(false);
  const open = hovered || pinned;

  const pin = useCallback(() => {
    focusIn.current = true;
    setPinned(true);
  }, []);
  const { team, select } = useTeamSurface(turn);

  const close = useCallback(() => {
    clearTimeout(leaving.current);
    focusIn.current = false;
    setHovered(false);
    setPinned(false);
  }, []);

  useLayoutEffect(() => {
    if (!pinned || !focusIn.current) return;
    focusIn.current = false;
    popover.current?.focus({ preventScroll: true });
  }, [pinned, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (popover.current?.contains(document.activeElement)) button.current?.focus();
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
        aria-label={
          team.working > 0
            ? t("Agent Team, {count} working", { count: team.working })
            : t("Agent Team")
        }
        title={t("Agent Team")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        data-working={team.working}
        onClick={() => (open ? close() : pin())}
      >
        <TeamAvatars rows={team.rows} />
        <span className="team-trigger__label">{t("Agent Team")}</span>
        {team.working > 0 && (
          <span className="team-trigger__count">
            <span className="team-trigger__count-full">
              {t("{count} working", { count: team.working })}
            </span>
            <span className="team-trigger__count-compact" aria-hidden="true">
              {team.working}
            </span>
          </span>
        )}
      </button>
      {open && (
        <div
          ref={popover}
          id={popoverId}
          className="team-popover"
          role="dialog"
          aria-label={t("Specialist team")}
          tabIndex={-1}
        >
          <TeamPanel
            model={team}
            onSelect={(assistant) => {
              onReveal?.();
              select(assistant);
              close();
            }}
          />
        </div>
      )}
    </div>
  );
}
