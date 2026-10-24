"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AgentProgressEvent, AssistantId } from "@trip/shared";

export interface TeamReveal {
  activity: readonly AgentProgressEvent[];
  assistant: AssistantId;
  nonce: number;
}

export interface TeamRevealState {
  reveal: TeamReveal | undefined;
  open: (activity: readonly AgentProgressEvent[], assistant: AssistantId) => void;
}

const TeamRevealContext = createContext<TeamRevealState>({
  reveal: undefined,
  open: () => undefined,
});

export const TeamRevealProvider = TeamRevealContext.Provider;

export function useTeamReveal() {
  return useContext(TeamRevealContext);
}

export function useTeamRevealState(): TeamRevealState {
  const [reveal, setReveal] = useState<TeamReveal | undefined>();
  const open = useCallback((activity: readonly AgentProgressEvent[], assistant: AssistantId) => {
    setReveal((current) => ({ activity, assistant, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);
  return useMemo(() => ({ reveal, open }), [reveal, open]);
}
