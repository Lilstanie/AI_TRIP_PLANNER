"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AgentProgressEvent } from "@trip/shared";
import type { Message } from "@/lib/workspace";

export interface TeamRun {
  index: number;
  turn: number;
  activity: readonly AgentProgressEvent[];
}

export interface TeamRunState {
  run: TeamRun | undefined;
  request: number;
  show: (run: TeamRun) => void;
  showLatest: () => void;
}

const TeamRunContext = createContext<TeamRunState>({
  run: undefined,
  request: 0,
  show: () => undefined,
  showLatest: () => undefined,
});

export const TeamRunProvider = TeamRunContext.Provider;

export function useTeamRun() {
  return useContext(TeamRunContext);
}

export function useTeamRunState(messages: readonly Message[], busy: boolean): TeamRunState {
  const [chosen, setChosen] = useState<TeamRun | undefined>();
  const [request, setRequest] = useState(0);
  useEffect(() => {
    if (busy) setChosen(undefined);
  }, [busy]);
  const show = useCallback((run: TeamRun) => {
    setChosen(run);
    setRequest((count) => count + 1);
  }, []);
  const showLatest = useCallback(() => setChosen(undefined), []);
  const run = chosen && messages[chosen.index]?.activity === chosen.activity ? chosen : undefined;
  return useMemo(() => ({ run, request, show, showLatest }), [run, request, show, showLatest]);
}
