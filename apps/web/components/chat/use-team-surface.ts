"use client";
import { useMemo } from "react";
import type { AssistantId } from "@trip/shared";
import { teamModel, type TeamModel, type TeamTurn } from "./team-model";
import { useTrajectoryFocus } from "./trajectory-focus";

export function useTeamSurface(turn: TeamTurn): {
  team: TeamModel;
  select: (assistant: AssistantId) => void;
} {
  const { open: select } = useTrajectoryFocus();
  const { activity, settled, interrupted } = turn;
  const team = useMemo(
    () => teamModel(activity, settled, interrupted),
    [activity, settled, interrupted],
  );
  return { team, select };
}
