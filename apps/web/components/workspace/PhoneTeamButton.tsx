"use client";
import { useEffect, useMemo, useRef } from "react";
import type { AgentProgressEvent } from "@trip/shared";
import { useLocale } from "../account/LocaleProvider";
import { TeamAvatars } from "../chat/TeamControl";
import { TeamPanel } from "../chat/TeamPanel";
import { TeamRunBar } from "../chat/TeamRunBar";
import { teamModel } from "../chat/team-model";
import { useTeamRun } from "../chat/team-run";
import type { CloseReason } from "../preferences/FactPopover";
import { FactPopover } from "../preferences/FactPopover";
import { usePresence } from "../ui/motion";
import type { WorkspaceModel } from "./useWorkspace";

const TEAM_SHEET_ID = "team-sheet";

export function PhoneTeamButton({
  model,
  activity,
  busy,
}: {
  model: WorkspaceModel;
  activity: readonly AgentProgressEvent[];
  busy: boolean;
}) {
  const { t } = useLocale();
  const team = useMemo(() => teamModel(activity, !busy), [activity, busy]);
  const { openTeamSheet, closeTeamSheet } = model.layout;
  const button = useRef<HTMLButtonElement>(null);
  const open = model.layout.surface.sheet === "team";
  const sheet = usePresence(open || undefined, 220);
  const { run, request, showLatest } = useTeamRun();
  const handled = useRef(request);
  useEffect(() => {
    if (handled.current === request) return;
    handled.current = request;
    openTeamSheet();
  }, [request, openTeamSheet]);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) showLatest();
    wasOpen.current = open;
  }, [open, showLatest]);

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
        aria-label={t("Specialist team")}
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
          title={t("Specialist team")}
          anchor={button}
          onClose={close}
          modal
          leaving={sheet.leaving}
          className="fact-popover--team"
        >
          <TeamRunBar />
          {run ? (
            <TeamPanel activity={run.activity} settled />
          ) : (
            <TeamPanel activity={activity} settled={!busy} model={team} />
          )}
        </FactPopover>
      )}
    </>
  );
}
