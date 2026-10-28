"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
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
  claim: (nonce: number) => boolean;
}

const TrajectoryFocusContext = createContext<TrajectoryFocusState>({
  focus: undefined,
  open: () => undefined,
  openTurn: () => undefined,
  claim: () => false,
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
  const claimed = useRef(0);
  const claim = useCallback((nonce: number) => {
    if (nonce <= claimed.current) return false;
    claimed.current = nonce;
    return true;
  }, []);
  return useMemo(() => ({ focus, open, openTurn, claim }), [focus, open, openTurn, claim]);
}
