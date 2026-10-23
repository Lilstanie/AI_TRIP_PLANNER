"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AgentProgressEvent, AssistantId } from "@trip/shared";
import type { Message } from "@/lib/workspace";

export interface TeamRun {
  index: number;
  turn: number;
  activity: readonly AgentProgressEvent[];
}

export interface TeamReveal {
  activity: readonly AgentProgressEvent[];
  assistant: AssistantId;
  nonce: number;
}

export interface TeamRunState {
  run: TeamRun | undefined;
  request: number;
  reveal: TeamReveal | undefined;
  show: (run: TeamRun) => void;
  showLatest: () => void;
  open: (activity: readonly AgentProgressEvent[], assistant: AssistantId) => void;
}

const TeamRunContext = createContext<TeamRunState>({
  run: undefined,
  request: 0,
  reveal: undefined,
  show: () => undefined,
  showLatest: () => undefined,
  open: () => undefined,
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
  const [reveal, setReveal] = useState<TeamReveal | undefined>();
  const open = useCallback((activity: readonly AgentProgressEvent[], assistant: AssistantId) => {
    setReveal((current) => ({ activity, assistant, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);
  const run = chosen && messages[chosen.index]?.activity === chosen.activity ? chosen : undefined;
  return useMemo(
    () => ({ run, request, reveal, show, showLatest, open }),
    [run, request, reveal, show, showLatest, open],
  );
}
