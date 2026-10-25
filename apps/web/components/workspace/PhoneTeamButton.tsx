"use client";
import { useRef } from "react";
import { useLocale } from "../account/LocaleProvider";
import { TeamAvatars } from "../chat/TeamControl";
import { TeamPanel } from "../chat/TeamPanel";
import type { TeamTurn } from "../chat/team-model";
import { useTeamSurface } from "../chat/use-team-surface";
import type { CloseReason } from "../preferences/FactPopover";
import { FactPopover } from "../preferences/FactPopover";
import { usePresence } from "../ui/motion";
import type { WorkspaceModel } from "./useWorkspace";

const TEAM_SHEET_ID = "team-sheet";

export function PhoneTeamButton({ model, turn }: { model: WorkspaceModel; turn: TeamTurn }) {
  const { t } = useLocale();
  const { openTeamSheet, closeTeamSheet } = model.layout;
  const button = useRef<HTMLButtonElement>(null);
  const open = model.layout.surface.sheet === "team";
  const sheet = usePresence(open || undefined, 220);
  const { team, select } = useTeamSurface(turn);

  const close = (reason: CloseReason) => {
    closeTeamSheet();
    if (reason === "dismiss") button.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="topbar-button team-trigger phone-topbar__team"
        aria-label={t("Agent Team")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? TEAM_SHEET_ID : undefined}
        data-working={team.working}
        onClick={open ? closeTeamSheet : openTeamSheet}
      >
        <TeamAvatars rows={team.rows} />
      </button>
      {sheet.value && (
        <FactPopover
          key={sheet.leaving ? "leaving" : "open"}
          id={TEAM_SHEET_ID}
          title={t("Agent Team")}
          anchor={button}
          onClose={close}
          modal
          leaving={sheet.leaving}
          className="fact-popover--team"
        >
          <TeamPanel
            model={team}
            onSelect={(assistant) => {
              select(assistant);
              closeTeamSheet();
            }}
          />
        </FactPopover>
      )}
    </>
  );
}
