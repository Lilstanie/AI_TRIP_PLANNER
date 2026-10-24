"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AssistantId } from "@trip/shared";

export interface TrajectoryFocus {
  assistant: AssistantId;
  nonce: number;
}

export interface TrajectoryFocusState {
  focus: TrajectoryFocus | undefined;
  open: (assistant: AssistantId) => void;
}

const TrajectoryFocusContext = createContext<TrajectoryFocusState>({
  focus: undefined,
  open: () => undefined,
});

export const TrajectoryFocusProvider = TrajectoryFocusContext.Provider;

export function useTrajectoryFocus() {
  return useContext(TrajectoryFocusContext);
}

export function useTrajectoryFocusState(): TrajectoryFocusState {
  const [focus, setFocus] = useState<TrajectoryFocus | undefined>();
  const open = useCallback((assistant: AssistantId) => {
    setFocus((current) => ({ assistant, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);
  return useMemo(() => ({ focus, open }), [focus, open]);
}
