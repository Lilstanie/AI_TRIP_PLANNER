"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { AssistantId } from "@trip/shared";
import { teamModel, type TeamModel, type TeamTurn } from "./team-model";
import { useTeamRun } from "./team-run";

export function useTeamSurface(
  turn: TeamTurn,
  open: boolean,
  onRequest: () => void,
): { live: TeamModel; shown: TeamModel; select: (assistant: AssistantId) => void } {
  const { run, request, showLatest, open: reveal } = useTeamRun();
  const { activity, settled, interrupted } = turn;
  const live = useMemo(
    () => teamModel(activity, settled, interrupted),
    [activity, settled, interrupted],
  );
  const shown = useMemo(() => (run ? teamModel(run.activity, true) : live), [run, live]);
  const handled = useRef(request);
  useEffect(() => {
    if (handled.current === request) return;
    handled.current = request;
    onRequest();
  }, [request, onRequest]);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) showLatest();
    wasOpen.current = open;
  }, [open, showLatest]);
  const select = useCallback(
    (assistant: AssistantId) => reveal(run ? run.activity : activity, assistant),
    [reveal, run, activity],
  );
  return { live, shown, select };
}
