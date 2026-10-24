"use client";
import { useCallback, useMemo } from "react";
import type { AssistantId } from "@trip/shared";
import { teamModel, type TeamModel, type TeamTurn } from "./team-model";
import { useTeamReveal } from "./team-reveal";

export function useTeamSurface(turn: TeamTurn): {
  team: TeamModel;
  select: (assistant: AssistantId) => void;
} {
  const { open: reveal } = useTeamReveal();
  const { activity, settled, interrupted } = turn;
  const team = useMemo(
    () => teamModel(activity, settled, interrupted),
    [activity, settled, interrupted],
  );
  const select = useCallback(
    (assistant: AssistantId) => reveal(activity, assistant),
    [reveal, activity],
  );
  return { team, select };
}
