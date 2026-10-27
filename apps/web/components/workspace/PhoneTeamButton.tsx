"use client";
import { useEffect, useRef } from "react";
import { useLocale } from "../account/LocaleProvider";
import { TeamAvatars } from "../chat/TeamControl";
import { TeamPanel } from "../chat/TeamPanel";
import type { TeamTurn } from "../chat/team-model";
import { useTeamSurface } from "../chat/use-team-surface";
import { PhoneTrajectory } from "./PhoneTrajectory";
import type { WorkspaceModel } from "./useWorkspace";

const TEAM_SHEET_ID = "team-sheet";

export function PhoneTeamButton({ model, turn }: { model: WorkspaceModel; turn: TeamTurn }) {
  const { t } = useLocale();
  const { openTeamSheet, closeTeamSheet } = model.layout;
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const roster = useRef<HTMLDetailsElement>(null);
  const open = model.layout.surface.sheet === "team";
  const { team, select } = useTeamSurface(turn);
  const { messages, activity, busy } = model.session;

  useEffect(() => {
    const surface = dialog.current;
    if (!surface || !open) return;
    const trigger = button.current;
    surface.showModal();
    return () => {
      surface.close();
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="topbar-button team-trigger phone-topbar__team"
        aria-label={
          team.working > 0
            ? t("Agent Team, {count} working", { count: team.working })
            : t("Agent Team")
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={TEAM_SHEET_ID}
        data-working={team.working}
        onClick={openTeamSheet}
      >
        <TeamAvatars rows={team.rows} />
        {team.working > 0 && (
          <span className="team-trigger__count" aria-hidden="true">
            <span className="team-trigger__count-full">
              {t("{count} working", { count: team.working })}
            </span>
            <span className="team-trigger__count-compact">{team.working}</span>
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        id={TEAM_SHEET_ID}
        className="phone-trajectory"
        aria-labelledby="phone-trajectory-title"
        aria-modal="true"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const items = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
            ),
          ].filter((item) => item.checkVisibility());
          const first = items[0];
          const last = items.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          closeTeamSheet();
        }}
      >
        <header className="phone-trajectory__head">
          <h2 id="phone-trajectory-title">{t("Trajectory")}</h2>
          <button
            type="button"
            className="phone-trajectory__close"
            onClick={closeTeamSheet}
            aria-label={t("Close {v0}", { v0: t("Trajectory") })}
          >
            {t("Close")}
          </button>
        </header>
        <details ref={roster} className="phone-trajectory__team">
          <summary>{t("Specialist team")}</summary>
          <TeamPanel
            model={team}
            onSelect={(assistant) => {
              select(assistant);
              if (roster.current) roster.current.open = false;
              requestAnimationFrame(() =>
                dialog.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus(),
              );
            }}
          />
        </details>
        <PhoneTrajectory
          messages={messages}
          activity={activity}
          busy={busy}
          visible={open}
          onReveal={openTeamSheet}
          onPlanInChat={() => {
            closeTeamSheet();
            model.layout.selectView("chat");
          }}
        />
      </dialog>
    </>
  );
}
