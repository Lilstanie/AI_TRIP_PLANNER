"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AssistantId } from "@trip/shared";

export interface TrajectoryFocus {
  assistant: AssistantId | undefined;
  turn: number | undefined;
  nonce: number;
}

export interface TrajectoryFocusState {
  focus: TrajectoryFocus | undefined;
  open: (assistant: AssistantId) => void;
  openTurn: (turn: number) => void;
}

const TrajectoryFocusContext = createContext<TrajectoryFocusState>({
  focus: undefined,
  open: () => undefined,
  openTurn: () => undefined,
});

export const TrajectoryFocusProvider = TrajectoryFocusContext.Provider;

export function useTrajectoryFocus() {
  return useContext(TrajectoryFocusContext);
}

export function useTrajectoryFocusState(): TrajectoryFocusState {
  const [focus, setFocus] = useState<TrajectoryFocus | undefined>();
  const open = useCallback((assistant: AssistantId) => {
    setFocus((current) => ({ assistant, turn: undefined, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);
  const openTurn = useCallback((turn: number) => {
    setFocus((current) => ({ assistant: undefined, turn, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);
  return useMemo(() => ({ focus, open, openTurn }), [focus, open, openTurn]);
}
