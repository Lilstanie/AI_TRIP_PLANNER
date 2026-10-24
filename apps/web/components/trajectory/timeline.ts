/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

import type { TrajectoryTurnModel } from "./layout";
import type { TrajectoryCellKind } from "./trajectory-record";

export interface TrajectoryTimeRange {
  start: number;
  end: number;
}

export interface TrajectoryTimelineSpan extends TrajectoryTimeRange {
  index: number;
  isError: boolean;
  kind: TrajectoryCellKind;
  label: string;
  lane: number;
}

export interface TrajectoryTimelineTurnBoundary {
  turn: number;
  time: number;
}

export interface TrajectoryTimelineModel extends TrajectoryTimeRange {
  spans: readonly TrajectoryTimelineSpan[];
  turnBoundaries: readonly TrajectoryTimelineTurnBoundary[];
}

function laneFor(kind: TrajectoryCellKind): number {
  if (kind === "tool" || kind === "subtool") return 2;
  if (kind === "message") return 1;
  return 0;
}

export function deriveTrajectoryTimeline(
  turns: readonly TrajectoryTurnModel[],
): TrajectoryTimelineModel | null {
  const spans: TrajectoryTimelineSpan[] = [];
  const turnBoundaries: TrajectoryTimelineTurnBoundary[] = [];

  for (const turn of turns) {
    const cells = turn.groups.flatMap((group) => group.cells);
    if (cells.length === 0) continue;
    if (turn.turn !== null) {
      turnBoundaries.push({
        turn: turn.turn,
        time: spans.length,
      });
    }
    spans.push(
      ...cells.map((cell, offset): TrajectoryTimelineSpan => ({
        start: spans.length + offset,
        end: spans.length + offset + 1,
        index: cell.index,
        isError: cell.isError === true,
        kind: cell.kind,
        label: cell.text,
        lane: laneFor(cell.kind),
      })),
    );
  }

  if (spans.length === 0) return null;
  return {
    start: 0,
    end: spans.length,
    spans,
    turnBoundaries,
  };
}

export function trajectoryTimelineFocusIndexes(
  turns: readonly TrajectoryTurnModel[],
  range: TrajectoryTimeRange,
): ReadonlySet<number> {
  const model = deriveTrajectoryTimeline(turns);
  return new Set(
    model?.spans
      .filter((span) => span.start <= range.end && span.end >= range.start)
      .map((span) => span.index),
  );
}
