/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Tooltip } from "./shim";
import type { TrajectoryCellProps } from "./trajectory-record";
import { trajectoryRecordId } from "./trajectory-record";
import {
  PHONE_CONTENT_ROW_HEIGHT,
  groupTrajectoryVirtualRows,
  trajectoryVirtualRecordKey,
} from "./trajectory-virtual-rows";
import type { TrajectoryVirtualRow } from "./trajectory-virtual-rows";
import type { TrajectoryTurnModel } from "./layout";
import type { TrajectoryTranslate } from "./locales";
import { KIND_ICON, KIND_LABEL_KEY, KIND_TAG_CLASS } from "./trajectory-kind";
import {
  assistantToolCalls,
  collapseAssistantRecords,
  collapseTurnRecords,
  detailTabs,
  filterRecords,
  flattenRecords,
  indexStepBoundaries,
  recordDisplayText,
  recordResultText,
  sectionLabel,
  stateOf,
  stepIdentity,
  stepKey,
  toolCallTextParts,
} from "./trajectory-table-records";
import type {
  DetailTab,
  TableRecord,
  ToolCallTextParts,
  TrajectoryStep,
} from "./trajectory-table-records";
import { TrajectoryInspector } from "./TrajectoryInspector";
import css from "./TrajectoryTable.module.css";

const BOTTOM_FOLLOW_THRESHOLD_PX = 2;
const VIRTUALIZATION_THRESHOLD = 100;
const VIRTUAL_OVERSCAN_ROWS = 12;
const VIRTUAL_INITIAL_VIEWPORT_HEIGHT_PX = 600;

interface VirtualRowStructure {
  height: number;
  key: string;
}

function useStableVirtualRowStructure(
  rows: readonly TrajectoryVirtualRow<TableRecord>[],
): readonly VirtualRowStructure[] {
  const cache = useRef<{
    rows: readonly TrajectoryVirtualRow<TableRecord>[];
    structure: readonly VirtualRowStructure[];
  }>({ rows: [], structure: [] });
  if (cache.current.rows === rows) return cache.current.structure;
  const structure =
    cache.current.structure.length === rows.length &&
    rows.every((row, index) => {
      const previous = cache.current.structure[index];
      return previous?.key === row.key && previous.height === row.height;
    })
      ? cache.current.structure
      : rows.map((row) => ({ key: row.key, height: row.height }));
  cache.current = { rows, structure };
  return structure;
}

type TrajectorySplitStyle = CSSProperties & {
  "--trajectory-tool-request-width": string;
};

type VirtualSpacerStyle = CSSProperties & {
  "--trajectory-virtual-spacer-height": string;
};

export interface TrajectoryTableProps {
  t: TrajectoryTranslate;
  steps: readonly TrajectoryStep[];
  turns: readonly TrajectoryTurnModel[];
  timelineFocusIndexes?: ReadonlySet<number> | null;
  searchMatchIndexes?: ReadonlySet<number> | null;
  searchActiveIndex?: number | null;
  onSelectedIndexChange?: (index: number | null) => void;
  onRecordSelect?: (index: number) => void;
  recordSelection?: { readonly index: number } | null;
  recordFocus?: { readonly index: number } | null;
  onClearSelection?: () => void;
  collapsedTurns: ReadonlySet<number>;
  onToggleTurn: (turn: number) => void;
  collapsedAssistants: ReadonlySet<string>;
  onToggleAssistant: (id: string) => void;
  phone?: boolean;
}

interface RecordPresentationValue {
  displayText: string;
  listDisplayText: string;
  resultText: string | undefined;
  toolCallText: ToolCallTextParts | undefined;
}

function RecordPresentation({
  cell,
  children,
}: {
  cell: TrajectoryCellProps;
  children: (value: RecordPresentationValue) => ReactNode;
}) {
  const displayText = recordDisplayText(cell);
  const resultText = recordResultText(cell);
  const toolCallText = toolCallTextParts(cell, displayText);
  const listDisplayText =
    toolCallText === undefined
      ? displayText
      : [toolCallText.name, toolCallText.args].filter(Boolean).join(" ");
  return children({ displayText, listDisplayText, resultText, toolCallText });
}

function RecordListText({
  displayText,
  toolCallText,
}: Pick<RecordPresentationValue, "displayText" | "toolCallText">) {
  if (toolCallText === undefined) return displayText || "—";
  return (
    <>
      <span className={css.toolCallNameTypeface}>{toolCallText.name || "—"}</span>
      {toolCallText.args !== undefined && (
        <span className={css.toolCallPayload}>{toolCallText.args}</span>
      )}
    </>
  );
}

/**
 * Render trajectory records as a dense ledger with turn and step separators.
 * Clicking ledger whitespace clears the active record or step selection.
 * @param props - Grouped trajectory data and whole-ledger fold state.
 * @returns The ledger and an optional local record inspector.
 */
export function TrajectoryTable({
  t,
  steps,
  turns,
  timelineFocusIndexes = null,
  searchMatchIndexes = null,
  searchActiveIndex = null,
  onSelectedIndexChange,
  onRecordSelect,
  recordSelection = null,
  recordFocus = null,
  onClearSelection,
  collapsedTurns,
  onToggleTurn,
  collapsedAssistants,
  onToggleAssistant,
  phone = false,
}: TrajectoryTableProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedStepIdentity, setSelectedStepIdentity] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [detailsWidth, setDetailsWidth] = useState<number | null>(null);
  const [toolRequestOffset, setToolRequestOffset] = useState<number | null>(null);
  const appliedRecordSelection = useRef<TrajectoryTableProps["recordSelection"]>(null);
  const appliedRecordFocus = useRef<TrajectoryTableProps["recordFocus"]>(null);
  const tabHistory = useRef<Set<DetailTab>>(new Set(["overview"]));
  const rootRef = useRef<HTMLDivElement>(null);
  const tablePaneRef = useRef<HTMLDivElement>(null);
  const followsTableTail = useRef(false);
  const tableScrollInitialized = useRef(false);
  const pendingScrollRecordId = useRef<string | null>(null);
  const allRecords = useMemo(() => flattenRecords(turns), [turns]);
  const selected = useMemo(
    () =>
      selectedRecordId === null
        ? undefined
        : allRecords.find((record) => trajectoryRecordId(record.cell) === selectedRecordId),
    [allRecords, selectedRecordId],
  );
  const selectedIndex = selected?.cell.index ?? null;
  useEffect(() => {
    onSelectedIndexChange?.(selectedIndex);
  }, [onSelectedIndexChange, selectedIndex]);
  const stepGroups = useMemo(
    () => new Set(steps.map((step) => stepKey(step.turn, step.group))),
    [steps],
  );
  const stepsByKey = useMemo(
    () => new Map(steps.map((step) => [stepKey(step.turn, step.group), step])),
    [steps],
  );
  const stepBoundaries = useMemo(
    () => indexStepBoundaries(allRecords, stepGroups),
    [allRecords, stepGroups],
  );
  const records = useMemo(() => {
    if (searchMatchIndexes !== null) return filterRecords(allRecords, searchMatchIndexes);
    const turnRecords =
      collapsedTurns.size === 0
        ? allRecords
        : collapseTurnRecords(allRecords, collapsedTurns, stepGroups, t);
    return collapsedAssistants.size === 0
      ? turnRecords
      : collapseAssistantRecords(turnRecords, collapsedAssistants, t);
  }, [allRecords, collapsedAssistants, collapsedTurns, stepGroups, searchMatchIndexes, t]);
  const projectedVirtualRows = useMemo(
    () => groupTrajectoryVirtualRows(records, phone ? PHONE_CONTENT_ROW_HEIGHT : undefined),
    [records, phone],
  );
  const virtualRowStructure = useStableVirtualRowStructure(projectedVirtualRows);
  const virtualizationEnabled = records.length > VIRTUALIZATION_THRESHOLD;
  const estimateVirtualRowSize = useCallback(
    (index: number) => virtualRowStructure[index]?.height ?? 30,
    [virtualRowStructure],
  );
  const getVirtualRowKey = useCallback(
    (index: number) => virtualRowStructure[index]?.key ?? index,
    [virtualRowStructure],
  );
  const getTableScrollElement = useCallback(() => tablePaneRef.current, []);
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: virtualizationEnabled ? virtualRowStructure.length : 0,
    enabled: virtualizationEnabled,
    estimateSize: estimateVirtualRowSize,
    getItemKey: getVirtualRowKey,
    getScrollElement: getTableScrollElement,
    initialRect: { width: 0, height: VIRTUAL_INITIAL_VIEWPORT_HEIGHT_PX },
    anchorTo: "end",
    overscan: VIRTUAL_OVERSCAN_ROWS,
    scrollEndThreshold: BOTTOM_FOLLOW_THRESHOLD_PX,
    followOnAppend: "auto",
  });
  const virtualIndexByRecordId = useMemo(() => {
    const indexes = new Map<string, number>();
    for (const [virtualIndex, row] of projectedVirtualRows.entries()) {
      for (const entry of row.entries) {
        if (entry.record.collapsedSummary === undefined) {
          indexes.set(trajectoryRecordId(entry.record.cell), virtualIndex);
        }
      }
    }
    return indexes;
  }, [projectedVirtualRows]);
  const virtualItems = virtualizationEnabled ? rowVirtualizer.getVirtualItems() : [];
  const virtualTop = virtualItems[0]?.start ?? 0;
  const virtualBottom =
    virtualItems.length === 0
      ? 0
      : Math.max(0, rowVirtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0));
  const renderedRecords = virtualizationEnabled
    ? virtualItems.flatMap((item) => {
        const row = projectedVirtualRows[item.index];
        return row === undefined
          ? []
          : row.entries.map((entry) => ({ record: entry.record, position: entry.logicalIndex }));
      })
    : records.map((record, position) => ({ record, position }));
  const selectedStepInfo =
    selectedStepIdentity === null
      ? undefined
      : steps.find((step) => stepIdentity(step) === selectedStepIdentity);
  const selectedStepRecords =
    selectedStepInfo === undefined
      ? []
      : allRecords.filter(
          (record) =>
            record.turn === selectedStepInfo.turn && record.group === selectedStepInfo.group,
        );
  const activeTurn = selectedStepInfo === undefined ? selected?.turn : selectedStepInfo.turn;
  const activeSection =
    selectedStepInfo === undefined ? selected?.section : selectedStepRecords[0]?.section;
  const splitStyle: TrajectorySplitStyle | undefined =
    toolRequestOffset === null
      ? undefined
      : { "--trajectory-tool-request-width": `calc(58cqw - ${toolRequestOffset}px)` };

  const activateTab = (tab: DetailTab) => {
    tabHistory.current.delete(tab);
    tabHistory.current.add(tab);
    setActiveTab(tab);
  };

  const clearInspectorSelection = () => {
    setSelectedRecordId(null);
    setSelectedStepIdentity(null);
  };

  const closeInspector = () => {
    const row =
      selectedIndex === null
        ? null
        : rootRef.current?.querySelector<HTMLElement>(`tr[data-record-index="${selectedIndex}"]`);
    clearInspectorSelection();
    row?.focus();
  };

  const clearAllSelections = () => {
    clearInspectorSelection();
    onClearSelection?.();
  };

  const selectRecord = useCallback(
    (index: number) => {
      const record = allRecords.find((candidate) => candidate.cell.index === index);
      onRecordSelect?.(index);
      setSelectedStepIdentity(null);
      setSelectedRecordId(record === undefined ? null : trajectoryRecordId(record.cell));
      if (record === undefined) return;
      const tabs = detailTabs(record);
      const available = new Set(tabs.map((tab) => tab.id));
      const recent = [...tabHistory.current].reverse().find((tab) => available.has(tab));
      setActiveTab(recent ?? tabs[0]?.id ?? "overview");
    },
    [allRecords, onRecordSelect],
  );
  useEffect(() => {
    if (recordSelection === null || appliedRecordSelection.current === recordSelection) return;
    appliedRecordSelection.current = recordSelection;
    selectRecord(recordSelection.index);
    const record = allRecords.find((candidate) => candidate.cell.index === recordSelection.index);
    pendingScrollRecordId.current = record === undefined ? null : trajectoryRecordId(record.cell);
  }, [allRecords, recordSelection, selectRecord]);
  useEffect(() => {
    if (recordFocus === null || appliedRecordFocus.current === recordFocus) return;
    appliedRecordFocus.current = recordFocus;
    const record = allRecords.find((candidate) => candidate.cell.index === recordFocus.index);
    pendingScrollRecordId.current = record === undefined ? null : trajectoryRecordId(record.cell);
  }, [allRecords, recordFocus]);

  const selectStep = (step: TrajectoryStep) => {
    setSelectedRecordId(null);
    setSelectedStepIdentity(stepIdentity(step));
    activateTab("overview");
  };

  const openRecordSummary = (target: TableRecord) => {
    const targetAt = allRecords.findIndex((record) => record.cell.index === target.cell.index);
    if (target.turn !== null && collapsedTurns.has(target.turn)) onToggleTurn(target.turn);
    if (target.cell.kind === "tool" || target.cell.kind === "subtool") {
      for (let i = targetAt - 1; i >= 0; i--) {
        const candidate = allRecords[i];
        if (candidate === undefined || candidate.turn !== target.turn) break;
        if (candidate.cell.kind !== "message") continue;
        const assistantId = trajectoryRecordId(candidate.cell);
        if (collapsedAssistants.has(assistantId)) onToggleAssistant(assistantId);
        break;
      }
    }
    setSelectedStepIdentity(null);
    setSelectedRecordId(trajectoryRecordId(target.cell));
    activateTab("overview");
  };

  useEffect(() => {
    const id = pendingScrollRecordId.current;
    if (id === null) return;
    const position = records.findIndex(
      (record) => trajectoryRecordId(record.cell) === id && record.collapsedSummary === undefined,
    );
    if (position === -1) return;
    followsTableTail.current = false;
    if (virtualizationEnabled) {
      const virtualIndex = virtualIndexByRecordId.get(id);
      if (virtualIndex === undefined) return;
      pendingScrollRecordId.current = null;
      rowVirtualizer.scrollToIndex(virtualIndex, { behavior: "smooth", align: "center" });
      return;
    }
    pendingScrollRecordId.current = null;
    const recordIndex = records[position]?.cell.index;
    const row =
      recordIndex === undefined
        ? null
        : rootRef.current?.querySelector<HTMLElement>(`tr[data-record-index="${recordIndex}"]`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [
    records,
    recordFocus,
    recordSelection,
    rowVirtualizer,
    virtualIndexByRecordId,
    virtualizationEnabled,
  ]);
  useEffect(() => {
    if (timelineFocusIndexes === null || timelineFocusIndexes.size === 0) return;
    if (!virtualizationEnabled) {
      const focusedRows = [
        ...(rootRef.current?.querySelectorAll<HTMLElement>('tr[data-timeline-focus="inside"]') ??
          []),
      ];
      const target = focusedRows[Math.floor((focusedRows.length - 1) / 2)];
      if (target === undefined) return;
      followsTableTail.current = false;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const focusedVirtualIndexes = [
      ...new Set(
        records.flatMap((record) => {
          if (record.collapsedSummary !== undefined || !timelineFocusIndexes.has(record.cell.index))
            return [];
          const virtualIndex = virtualIndexByRecordId.get(trajectoryRecordId(record.cell));
          return virtualIndex === undefined ? [] : [virtualIndex];
        }),
      ),
    ].sort((left, right) => left - right);
    const target = focusedVirtualIndexes[Math.floor((focusedVirtualIndexes.length - 1) / 2)];
    if (target === undefined) return;
    followsTableTail.current = false;
    rowVirtualizer.scrollToIndex(target, { behavior: "smooth", align: "center" });
  }, [
    records,
    rowVirtualizer,
    timelineFocusIndexes,
    virtualIndexByRecordId,
    virtualizationEnabled,
  ]);
  useLayoutEffect(() => {
    const pane = tablePaneRef.current;
    if (pane === null) return;
    if (!tableScrollInitialized.current) {
      tableScrollInitialized.current = true;
      followsTableTail.current = true;
      if (virtualizationEnabled) rowVirtualizer.scrollToEnd({ behavior: "auto" });
      else pane.scrollTop = pane.scrollHeight;
      return;
    }
    if (followsTableTail.current && !virtualizationEnabled) pane.scrollTop = pane.scrollHeight;
  }, [rowVirtualizer, virtualRowStructure, virtualizationEnabled]);

  return (
    <div
      ref={rootRef}
      className={css.split}
      style={splitStyle}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        if (selectedStepInfo === undefined && selected === undefined) return;
        event.preventDefault();
        closeInspector();
      }}
    >
      <div
        ref={tablePaneRef}
        className={css.tablePane}
        data-trajectory-scroll=""
        onScroll={(event) => {
          const pane = event.currentTarget;
          followsTableTail.current =
            pane.scrollHeight - pane.clientHeight - pane.scrollTop <= BOTTOM_FOLLOW_THRESHOLD_PX;
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) clearAllSelections();
        }}
      >
        <table className={css.table} aria-rowcount={records.length}>
          <colgroup>
            <col className={css.eventColumn} />
            <col className={css.contentColumn} />
          </colgroup>
          <tbody>
            {virtualTop > 0 && (
              <tr className={css.virtualSpacer} data-virtual-spacer="top" aria-hidden="true">
                <td
                  colSpan={2}
                  style={
                    {
                      "--trajectory-virtual-spacer-height": `${virtualTop}px`,
                    } as VirtualSpacerStyle
                  }
                />
              </tr>
            )}
            {renderedRecords.map(({ record, position }) => (
              <RecordPresentation key={trajectoryVirtualRecordKey(record)} cell={record.cell}>
                {({ displayText, listDisplayText, resultText, toolCallText }) => {
                  const isCollapsedSummary = record.collapsedSummary !== undefined;
                  const key = stepKey(record.turn, record.group);
                  const stepInfo =
                    stepBoundaries.get(key) === record.cell.index &&
                    !isCollapsedSummary &&
                    (record.turn === null || !collapsedTurns.has(record.turn))
                      ? stepsByKey.get(key)
                      : undefined;
                  const stepLabel =
                    stepInfo === undefined ? undefined : t("step.label", { step: stepInfo.step });
                  const stepSelected =
                    stepInfo !== undefined && selectedStepIdentity === stepIdentity(stepInfo);
                  const sectionActive =
                    record.turn === null
                      ? activeSection === record.section
                      : activeTurn === record.turn;
                  const toggleCollapsed = () => {
                    if (record.collapsedSummaryKind === "turn" && record.turn !== null) {
                      onToggleTurn(record.turn);
                    } else onToggleAssistant(trajectoryRecordId(record.cell));
                  };
                  return (
                    <tr
                      tabIndex={0}
                      aria-rowindex={position + 1}
                      aria-label={
                        isCollapsedSummary
                          ? t("row.collapsedSummary", {
                              kind: t(
                                record.collapsedSummaryKind === "turn"
                                  ? "row.collapsedTurn"
                                  : "row.collapsedCalls",
                              ),
                              summary: record.collapsedSummary ?? "",
                            })
                          : t("row.aria", {
                              step:
                                stepLabel === undefined
                                  ? ""
                                  : t("row.stepPrefix", { step: stepLabel }),
                              kind: t(KIND_LABEL_KEY[record.cell.kind]),
                              content: listDisplayText || t("record.noContent"),
                            })
                      }
                      aria-selected={!isCollapsedSummary && selectedIndex === record.cell.index}
                      data-kind={record.cell.kind}
                      data-assistant={record.cell.assistants?.join(" ") || undefined}
                      data-trajectory-row-key={trajectoryVirtualRecordKey(record)}
                      data-virtual-position={virtualizationEnabled ? position : undefined}
                      data-record-index={isCollapsedSummary ? undefined : record.cell.index}
                      data-group-start={record.groupStart || undefined}
                      data-turn-start={record.turnStart || undefined}
                      data-error={record.cell.isError || undefined}
                      data-running={stateOf(record) === "running" || undefined}
                      data-turn-end={record.turnEnd || undefined}
                      data-collapsed-summary={record.collapsedSummaryKind}
                      data-selected={
                        (!isCollapsedSummary && selectedIndex === record.cell.index) || undefined
                      }
                      data-search-hit={
                        isCollapsedSummary || searchMatchIndexes === null ? undefined : "true"
                      }
                      data-search-active={
                        !isCollapsedSummary &&
                        searchMatchIndexes !== null &&
                        searchActiveIndex === record.cell.index
                          ? "true"
                          : undefined
                      }
                      data-timeline-focus={
                        isCollapsedSummary || timelineFocusIndexes === null
                          ? undefined
                          : timelineFocusIndexes.has(record.cell.index)
                            ? "inside"
                            : "outside"
                      }
                      onClick={
                        isCollapsedSummary
                          ? toggleCollapsed
                          : () => {
                              selectRecord(record.cell.index);
                            }
                      }
                      onDoubleClick={(event) => {
                        if (isCollapsedSummary) return;
                        if (record.turn !== null && collapsedTurns.has(record.turn)) {
                          event.preventDefault();
                          onToggleTurn(record.turn);
                          return;
                        }
                        if (
                          record.cell.kind === "message" &&
                          assistantToolCalls(allRecords, record.cell.index).length > 0
                        ) {
                          event.preventDefault();
                          onToggleAssistant(trajectoryRecordId(record.cell));
                          return;
                        }
                        if (!record.turnStart || record.turn === null) return;
                        if (
                          allRecords.filter((candidate) => candidate.turn === record.turn).length <=
                          1
                        )
                          return;
                        event.preventDefault();
                        onToggleTurn(record.turn);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        if (isCollapsedSummary) toggleCollapsed();
                        else selectRecord(record.cell.index);
                      }}
                    >
                      <td className={css.event}>
                        {stepInfo !== undefined && (
                          <button
                            type="button"
                            className={
                              stepSelected
                                ? `${css.stepMarker} ${css.stepMarkerActive}`
                                : css.stepMarker
                            }
                            aria-label={stepLabel}
                            aria-pressed={stepSelected}
                            data-label={stepLabel}
                            data-step-status={
                              stepInfo.status === "complete" ? undefined : stepInfo.status
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              selectStep(stepInfo);
                            }}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                            }}
                          />
                        )}
                        {record.turn !== null && activeTurn === record.turn && (
                          <span className={css.turnRail} aria-hidden="true" />
                        )}
                        {!isCollapsedSummary && selectedIndex === record.cell.index && (
                          <span className={css.selectionRail} aria-hidden="true" />
                        )}
                        {!isCollapsedSummary && record.turnStart && (
                          <span
                            className={
                              sectionActive
                                ? `${css.turnLabel} ${css.turnLabelActive}`
                                : css.turnLabel
                            }
                            aria-label={sectionLabel(record.turn, t)}
                          >
                            {record.turn === null ? (
                              sectionLabel(record.turn, t)
                            ) : (
                              <>
                                <span className={css.turnLabelFull} aria-hidden="true">
                                  {sectionLabel(record.turn, t)}
                                </span>
                                <span className={css.turnLabelCompact} aria-hidden="true">
                                  #{record.turn}
                                </span>
                              </>
                            )}
                          </span>
                        )}
                        <div className={css.eventInner}>
                          {!isCollapsedSummary && (
                            <span className={css.kindSlot}>
                              <span
                                className={`${css.kindTag} ${KIND_TAG_CLASS[record.cell.kind]}`}
                                data-role-kind={record.cell.kind}
                              >
                                <Tooltip label={t(KIND_LABEL_KEY[record.cell.kind])} side="right">
                                  <span className={css.kindTagIcon} aria-hidden="true">
                                    {KIND_ICON[record.cell.kind]}
                                  </span>
                                </Tooltip>
                                <span className={css.kindTagLabel}>
                                  {t(KIND_LABEL_KEY[record.cell.kind])}
                                </span>
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={css.content}>
                        {record.collapsedSummary !== undefined ? (
                          <span
                            className={css.collapsedTurnContent}
                            title={record.collapsedSummary}
                          >
                            <span className={css.collapsedTurnEllipsis}>…</span>
                            <span className={css.collapsedTurnText}>{record.collapsedSummary}</span>
                          </span>
                        ) : (
                          <span
                            className={
                              resultText === undefined ? css.contentText : css.resultPreview
                            }
                            title={
                              resultText === undefined
                                ? listDisplayText
                                : `${listDisplayText} → ${resultText}`
                            }
                          >
                            <span
                              className={resultText === undefined ? undefined : css.resultRequest}
                            >
                              <RecordListText
                                displayText={displayText}
                                toolCallText={toolCallText}
                              />
                            </span>
                            {resultText !== undefined && (
                              <span
                                className={
                                  record.cell.isError
                                    ? `${css.inlineResult} ${css.error}`
                                    : css.inlineResult
                                }
                              >
                                <span className={css.arrow}>→</span>
                                <span className={css.inlineResultText}>{resultText}</span>
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                }}
              </RecordPresentation>
            ))}
            {virtualBottom > 0 && (
              <tr className={css.virtualSpacer} data-virtual-spacer="bottom" aria-hidden="true">
                <td
                  colSpan={2}
                  style={
                    {
                      "--trajectory-virtual-spacer-height": `${virtualBottom}px`,
                    } as VirtualSpacerStyle
                  }
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {(selectedStepInfo !== undefined || selected !== undefined) && (
        <TrajectoryInspector
          t={t}
          allRecords={allRecords}
          stepsByKey={stepsByKey}
          step={selectedStepInfo}
          stepRecords={selectedStepRecords}
          record={selected}
          activeTab={activeTab}
          onActivateTab={activateTab}
          onClose={closeInspector}
          onSelectStep={selectStep}
          onOpenRecord={openRecordSummary}
          detailsWidth={detailsWidth}
          toolRequestOffset={toolRequestOffset}
          onResize={(nextDetailsWidth, nextToolRequestOffset) => {
            setDetailsWidth(nextDetailsWidth);
            setToolRequestOffset(nextToolRequestOffset);
          }}
        />
      )}
    </div>
  );
}
