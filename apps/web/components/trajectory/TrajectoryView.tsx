/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TrajectoryTable } from "./TrajectoryTable";
import type { TrajectoryStep } from "./TrajectoryTable";
import { TrajectoryToolbar } from "./TrajectoryToolbar";
import { TrajectoryTimeline } from "./TrajectoryTimeline";
import type { TrajectoryTurnModel } from "./layout";
import type { TrajectoryTranslate } from "./locales";
import { trajectoryTimelineFocusIndexes } from "./timeline";
import type { TrajectoryTimeRange } from "./timeline";
import { trajectoryRecordId } from "./trajectory-record";
import { TrajectorySearchIndex } from "./trajectory-search-index";
import css from "./views.module.css";

const EMPTY_TURN_IDS: ReadonlySet<number> = new Set();
const EMPTY_RECORD_IDS: ReadonlySet<string> = new Set();

export interface TrajectoryViewProps {
  t: TrajectoryTranslate;
  turns: readonly TrajectoryTurnModel[];
  steps: readonly TrajectoryStep[];
  phone?: boolean;
  jump?: { readonly turn: number; readonly nonce: number };
  onJumped?: () => void;
}

/**
 * Compact timeline over a turn-aware ledger of the stored conversation.
 * @param props - The mapped turns, their steps and the translator.
 * @returns The toolbar, timeline overview and ledger with its record inspector.
 */
export function TrajectoryView({
  t,
  turns,
  steps,
  phone = false,
  jump,
  onJumped,
}: TrajectoryViewProps) {
  const [collapsedTurns, setCollapsedTurns] = useState<ReadonlySet<number>>(EMPTY_TURN_IDS);
  const [collapsedAssistants, setCollapsedAssistants] =
    useState<ReadonlySet<string>>(EMPTY_RECORD_IDS);
  const [timelineSelection, setTimelineSelection] = useState<TrajectoryTimeRange | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hitStep, setHitStep] = useState(0);
  const [searchIndex] = useState(() => new TrajectorySearchIndex());
  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState<number | null>(null);
  const [timelineRecordSelection, setTimelineRecordSelection] = useState<{
    readonly index: number;
  } | null>(null);
  const [timelineRecordFocus, setTimelineRecordFocus] = useState<{
    readonly index: number;
  } | null>(null);
  const layouts = useMemo(() => [turns], [turns]);
  const searchMatchIndexes = useMemo(() => {
    searchIndex.update(layouts);
    const matches = searchIndex.search(searchQuery);
    if (matches === null) return null;
    const indexes = new Set<number>();
    for (const turn of turns) {
      for (const group of turn.groups) {
        for (const cell of group.cells) {
          if (matches.has(trajectoryRecordId(cell))) indexes.add(cell.index);
        }
      }
    }
    return indexes;
  }, [searchIndex, searchQuery, layouts, turns]);
  const searchHits = useMemo(
    () => (searchMatchIndexes === null ? [] : [...searchMatchIndexes].sort((a, b) => a - b)),
    [searchMatchIndexes],
  );
  const hitPosition = searchHits.length === 0 ? 0 : Math.min(hitStep, searchHits.length - 1);
  const stepHit = useCallback(
    (delta: 1 | -1) => {
      if (searchHits.length === 0) return;
      const next = (hitPosition + delta + searchHits.length) % searchHits.length;
      setHitStep(next);
      const index = searchHits[next];
      if (index !== undefined) setTimelineRecordFocus({ index });
    },
    [hitPosition, searchHits],
  );
  const changeSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    setHitStep(0);
  }, []);
  const timelineFocusIndexes = useMemo(
    () =>
      timelineSelection === null ? null : trajectoryTimelineFocusIndexes(turns, timelineSelection),
    [timelineSelection, turns],
  );
  const handleRecordSelect = useCallback(
    (index: number) => {
      if (timelineFocusIndexes !== null && !timelineFocusIndexes.has(index)) {
        setTimelineSelection(null);
      }
    },
    [timelineFocusIndexes],
  );
  const handleTimelineRecordSelect = useCallback((index: number) => {
    setTimelineSelection(null);
    setTimelineRecordSelection({ index });
    setSelectedTimelineIndex(index);
  }, []);
  const handleTimelineRecordFocus = useCallback((index: number) => {
    setTimelineRecordFocus({ index });
  }, []);
  const collapsibleTurnIds = useMemo(
    () =>
      turns.flatMap((turn) =>
        turn.turn !== null &&
        turn.groups.reduce((count, group) => count + group.cells.length, 0) > 1
          ? [turn.turn]
          : [],
      ),
    [turns],
  );
  const allTurnsCollapsed =
    collapsibleTurnIds.length > 0 && collapsibleTurnIds.every((turn) => collapsedTurns.has(turn));
  const collapsibleAssistantIds = useMemo(() => {
    const ids: string[] = [];
    for (const turn of turns) {
      const cells = turn.groups.flatMap((group) => group.cells);
      for (const [position, cell] of cells.entries()) {
        const next = cells[position + 1];
        if (cell.kind === "message" && (next?.kind === "tool" || next?.kind === "subtool")) {
          ids.push(trajectoryRecordId(cell));
        }
      }
    }
    return ids;
  }, [turns]);
  const allAssistantsCollapsed =
    collapsibleAssistantIds.length > 0 &&
    collapsibleAssistantIds.every((id) => collapsedAssistants.has(id));

  useEffect(() => {
    if (jump === undefined) return;
    const first = turns.find((candidate) => candidate.turn === jump.turn)?.groups[0]?.cells[0];
    setCollapsedTurns((current) => {
      if (!current.has(jump.turn)) return current;
      const collapsed = new Set(current);
      collapsed.delete(jump.turn);
      return collapsed;
    });
    if (first !== undefined) setTimelineRecordFocus({ index: first.index });
    onJumped?.();
  }, [jump, turns, onJumped]);

  const toggleTurn = (turn: number) => {
    setCollapsedTurns((current) => {
      const collapsed = new Set(current);
      if (collapsed.has(turn)) collapsed.delete(turn);
      else collapsed.add(turn);
      return collapsed;
    });
  };

  const toggleAllTurns = () => {
    setCollapsedTurns((current) => {
      const collapsed = new Set(current);
      for (const turn of collapsibleTurnIds) {
        if (allTurnsCollapsed) collapsed.delete(turn);
        else collapsed.add(turn);
      }
      return collapsed;
    });
  };

  const toggleAssistant = (id: string) => {
    setCollapsedAssistants((current) => {
      const collapsed = new Set(current);
      if (collapsed.has(id)) collapsed.delete(id);
      else collapsed.add(id);
      return collapsed;
    });
  };

  const toggleAllAssistants = () => {
    setCollapsedAssistants((current) => {
      const collapsed = new Set(current);
      for (const id of collapsibleAssistantIds) {
        if (allAssistantsCollapsed) collapsed.delete(id);
        else collapsed.add(id);
      }
      return collapsed;
    });
  };

  return (
    <div className={css.root} data-trajectory-phone={phone || undefined}>
      <TrajectoryToolbar
        allTurnsCollapsed={allTurnsCollapsed}
        onToggleAllTurns={toggleAllTurns}
        allAssistantsCollapsed={allAssistantsCollapsed}
        onToggleAllAssistants={toggleAllAssistants}
        searchQuery={searchQuery}
        onSearchQueryChange={changeSearchQuery}
        hitCount={searchMatchIndexes === null ? null : searchHits.length}
        hitPosition={hitPosition}
        onStepHit={stepHit}
        t={t}
      />
      {!phone && (
        <TrajectoryTimeline
          t={t}
          turns={turns}
          range={timelineSelection}
          selectedIndex={selectedTimelineIndex}
          searchMatchIndexes={searchMatchIndexes}
          onRangeChange={setTimelineSelection}
          onRecordSelect={handleTimelineRecordSelect}
          onRecordFocus={handleTimelineRecordFocus}
        />
      )}
      <div className={css.ledger}>
        <TrajectoryTable
          t={t}
          steps={steps}
          turns={turns}
          timelineFocusIndexes={timelineFocusIndexes}
          searchMatchIndexes={searchMatchIndexes}
          searchActiveIndex={searchHits[hitPosition] ?? null}
          onSelectedIndexChange={setSelectedTimelineIndex}
          onRecordSelect={handleRecordSelect}
          recordSelection={timelineRecordSelection}
          recordFocus={timelineRecordFocus}
          onClearSelection={() => {
            setTimelineSelection(null);
          }}
          collapsedTurns={collapsedTurns}
          onToggleTurn={toggleTurn}
          collapsedAssistants={collapsedAssistants}
          onToggleAssistant={toggleAssistant}
          phone={phone}
        />
      </div>
    </div>
  );
}
