/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  IconChevronRightOutlineRegular,
  IconSparkleRegular,
  IconUserOutlineRegular,
  JsonTree,
  MarkdownText,
  Tooltip,
} from "./shim";
import type { TrajectoryCellKind, TrajectoryCellProps } from "./trajectory-record";
import { trajectoryRecordId } from "./trajectory-record";
import { groupTrajectoryVirtualRows, trajectoryVirtualRecordKey } from "./trajectory-virtual-rows";
import type { TrajectoryVirtualRow } from "./trajectory-virtual-rows";
import type { TrajectoryTurnModel } from "./layout";
import { trajectoryPreviewText } from "./trajectory-preview";
import type { TrajectoryKey, TrajectoryTranslate } from "./locales";
import css from "./TrajectoryTable.module.css";

const BOTTOM_FOLLOW_THRESHOLD_PX = 2;
const VIRTUALIZATION_THRESHOLD = 100;
const VIRTUAL_OVERSCAN_ROWS = 12;
const VIRTUAL_INITIAL_VIEWPORT_HEIGHT_PX = 600;

const KIND_LABEL_KEY: Record<TrajectoryCellKind, TrajectoryKey> = {
  user: "kind.user",
  message: "kind.assistant",
  tool: "kind.tool",
  subtool: "kind.subtool",
};

function ToolWrenchIcon(): ReactNode {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-role-icon="wrench"
      aria-hidden="true"
    >
      <path d="M14 3.3a3.8 3.8 0 0 1-4.8 4.8l-5.1 5.1a1.6 1.6 0 1 1-2.3-2.3l5.1-5.1A3.8 3.8 0 0 1 11.7 1l-2.3 2.3 2.3 2.3L14 3.3Z" />
    </svg>
  );
}

const KIND_ICON: Record<TrajectoryCellKind, ReactNode> = {
  user: <IconUserOutlineRegular size={13} />,
  message: <IconSparkleRegular size={13} />,
  tool: <ToolWrenchIcon />,
  subtool: <ToolWrenchIcon />,
};

const KIND_TAG_CLASS: Record<TrajectoryCellKind, string> = {
  user: css.user ?? "",
  message: css.assistantVioletBright ?? "",
  tool: css.toolAmber ?? "",
  subtool: css.subtoolAmber ?? "",
};

interface TableRecord {
  turn: number | null;
  section: number;
  group: string;
  groupStart: boolean;
  turnStart: boolean;
  cell: TrajectoryCellProps;
  turnEnd: boolean;
  collapsedSummary?: string;
  collapsedSummaryKind?: "turn" | "assistant";
}

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

type DetailTab = "overview" | "rendered" | "raw" | "input" | "output";
type RecordState = "complete" | "running" | "error";

interface DetailTabItem {
  id: DetailTab;
  labelKey: TrajectoryKey;
}

interface ToolCallTextParts {
  name: string;
  args?: string;
}

interface DetailsResizeDrag {
  pointerId: number;
  startX: number;
  startWidth: number;
  splitWidth: number;
  startToolRequestOffset: number;
}

const DETAILS_MIN_WIDTH = 320;
const DETAILS_MAX_WIDTH = 720;
const TABLE_MIN_WIDTH = 280;
const DETAILS_RESIZE_STEP = 16;
const TOOL_REQUEST_SHARE = 0.58;
const TOOL_REQUEST_MIN_WIDTH = 180;
const TOOL_REQUEST_MAX_WIDTH = 480;
const DEFAULT_TOOL_REQUEST_SHARE = 0.36;
const DEFAULT_TOOL_REQUEST_OFFSET = 56;
const STEP_TABS: readonly DetailTabItem[] = [{ id: "overview", labelKey: "tab.summary" }];

type TrajectorySplitStyle = CSSProperties & {
  "--trajectory-tool-request-width": string;
};

type VirtualSpacerStyle = CSSProperties & {
  "--trajectory-virtual-spacer-height": string;
};

function clampDetailsWidth(width: number, splitWidth: number): number {
  const maxWidth = Math.max(
    DETAILS_MIN_WIDTH,
    Math.min(DETAILS_MAX_WIDTH, splitWidth - TABLE_MIN_WIDTH),
  );
  return Math.round(Math.min(Math.max(width, DETAILS_MIN_WIDTH), maxWidth));
}

function defaultToolRequestWidth(splitWidth: number): number {
  return Math.min(
    Math.max(
      splitWidth * DEFAULT_TOOL_REQUEST_SHARE - DEFAULT_TOOL_REQUEST_OFFSET,
      TOOL_REQUEST_MIN_WIDTH,
    ),
    TOOL_REQUEST_MAX_WIDTH,
  );
}

export interface TrajectoryStep {
  turn: number;
  step: number;
  group: string;
  status: "complete" | "running" | "error";
}

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
}

function flattenRecords(turns: readonly TrajectoryTurnModel[]): TableRecord[] {
  return turns.flatMap((turn, section) => {
    let firstInSection = true;
    const records = turn.groups.flatMap((group) =>
      group.cells.map((cell, index) => {
        const turnStart = firstInSection;
        if (turnStart) firstInSection = false;
        return {
          turn: turn.turn,
          section,
          group: group.title,
          groupStart: index === 0,
          turnStart,
          cell,
          turnEnd: false,
        };
      }),
    );
    const last = records.at(-1);
    if (last !== undefined) last.turnEnd = true;
    return records;
  });
}

function filterRecords(
  records: readonly TableRecord[],
  matches: ReadonlySet<number>,
): TableRecord[] {
  const filtered = records
    .filter((record) => matches.has(record.cell.index))
    .map((record) => ({ ...record, groupStart: false, turnStart: false, turnEnd: false }));
  const startedSections = new Set<number>();
  for (const [index, record] of filtered.entries()) {
    const previous = filtered[index - 1];
    const next = filtered[index + 1];
    record.groupStart =
      previous === undefined ||
      previous.section !== record.section ||
      previous.group !== record.group;
    record.turnStart = !startedSections.has(record.section);
    if (record.turnStart) startedSections.add(record.section);
    record.turnEnd = next === undefined || next.section !== record.section;
  }
  return filtered;
}

function stepKey(turn: number | null, group: string): string {
  return `${turn}\u0000${group}`;
}

function stepIdentity(step: TrajectoryStep): string {
  return `${step.turn}\u0000${step.step}`;
}

function indexStepBoundaries(
  records: readonly TableRecord[],
  stepGroups: ReadonlySet<string>,
): ReadonlyMap<string, number> {
  const boundaries = new Map<string, number>();
  for (const record of records) {
    const key = stepKey(record.turn, record.group);
    if (stepGroups.has(key) && !boundaries.has(key)) boundaries.set(key, record.cell.index);
  }
  return boundaries;
}

function sectionLabel(turn: number | null, t: TrajectoryTranslate): string {
  return turn === null ? t("section.betweenTurns") : t("turn.label", { turn });
}

function summarizeTurn(
  records: readonly TableRecord[],
  stepGroups: ReadonlySet<string>,
  t: TrajectoryTranslate,
): string {
  const steps = new Set(
    records
      .map((record) => stepKey(record.turn, record.group))
      .filter((key) => stepGroups.has(key)),
  ).size;
  const toolCalls = records.filter(
    (record) => record.cell.kind === "tool" || record.cell.kind === "subtool",
  ).length;
  return [
    t(steps === 1 ? "summary.steps.one" : "summary.steps.other", { count: steps }),
    t(toolCalls === 1 ? "summary.toolCalls.one" : "summary.toolCalls.other", {
      count: toolCalls,
    }),
  ].join(" · ");
}

function collapseTurnRecords(
  records: readonly TableRecord[],
  collapsedTurns: ReadonlySet<number>,
  stepGroups: ReadonlySet<string>,
  t: TrajectoryTranslate,
): TableRecord[] {
  const recordsByTurn = new Map<number, TableRecord[]>();
  for (const record of records) {
    if (record.turn === null) continue;
    const turnRecords = recordsByTurn.get(record.turn) ?? [];
    turnRecords.push(record);
    recordsByTurn.set(record.turn, turnRecords);
  }
  return records.flatMap((record) => {
    if (record.turn === null || !collapsedTurns.has(record.turn)) return [record];
    const contentRecords = recordsByTurn.get(record.turn) ?? [record];
    if (contentRecords.length <= 1) return [record];
    if (record.cell.index !== contentRecords[0]?.cell.index) return [];
    return [
      { ...record, turnEnd: false },
      {
        ...record,
        groupStart: false,
        turnStart: false,
        turnEnd: true,
        collapsedSummary: summarizeTurn(contentRecords.slice(1), stepGroups, t),
        collapsedSummaryKind: "turn" as const,
      },
    ];
  });
}

function assistantToolCalls(
  records: readonly TableRecord[],
  assistantIndex: number,
): readonly TableRecord[] {
  const at = records.findIndex((record) => record.cell.index === assistantIndex);
  if (at === -1 || records[at]?.cell.kind !== "message") return [];
  const calls: TableRecord[] = [];
  for (let i = at + 1; i < records.length; i++) {
    const record = records[i];
    if (record === undefined) break;
    if (record.cell.kind !== "tool" && record.cell.kind !== "subtool") break;
    calls.push(record);
  }
  return calls;
}

function summarizeAssistantTools(records: readonly TableRecord[], t: TrajectoryTranslate): string {
  const names = [
    ...new Set(
      records
        .map((record) => {
          const separator = record.cell.text.indexOf(" · ");
          return separator === -1 ? record.cell.text : record.cell.text.slice(0, separator);
        })
        .filter((name) => name !== ""),
    ),
  ];
  const count = records.length;
  const summary = t(count === 1 ? "summary.toolCalls.one" : "summary.toolCalls.other", { count });
  return names.length > 0 ? `${summary} · ${names.join(", ")}` : summary;
}

function collapseAssistantRecords(
  records: readonly TableRecord[],
  collapsedAssistants: ReadonlySet<string>,
  t: TrajectoryTranslate,
): TableRecord[] {
  const out: TableRecord[] = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record === undefined) continue;
    out.push(record);
    if (record.cell.kind !== "message" || !collapsedAssistants.has(trajectoryRecordId(record.cell)))
      continue;
    const calls: TableRecord[] = [];
    for (let j = i + 1; j < records.length; j++) {
      const candidate = records[j];
      if (
        candidate === undefined ||
        candidate.collapsedSummary !== undefined ||
        (candidate.cell.kind !== "tool" && candidate.cell.kind !== "subtool")
      )
        break;
      calls.push(candidate);
    }
    if (calls.length === 0) continue;
    const last = calls.at(-1);
    out[out.length - 1] = { ...record, turnEnd: false };
    out.push({
      ...record,
      groupStart: false,
      turnStart: false,
      turnEnd: last?.turnEnd ?? false,
      collapsedSummary: summarizeAssistantTools(calls, t),
      collapsedSummaryKind: "assistant",
    });
    i += calls.length;
  }
  return out;
}

function stateOf(record: TableRecord): RecordState {
  if (record.cell.isError) return "error";
  return record.cell.running ? "running" : "complete";
}

function statusLabel(state: RecordState, t: TrajectoryTranslate): string {
  if (state === "error") return t("status.failed");
  if (state === "running") return t("status.pending");
  return t("status.completed");
}

function isMarkdownRecord(record: TableRecord): boolean {
  return record.cell.kind === "user" || record.cell.kind === "message";
}

function parentTool(records: readonly TableRecord[], record: TableRecord): TableRecord | undefined {
  if (record.cell.kind !== "subtool") return undefined;
  const at = records.findIndex((candidate) => candidate.cell.index === record.cell.index);
  for (let i = at - 1; i >= 0; i--) {
    const candidate = records[i];
    if (
      candidate === undefined ||
      candidate.turn !== record.turn ||
      candidate.group !== record.group
    )
      break;
    if (candidate.cell.kind === "tool") return candidate;
  }
  return undefined;
}

function markdownSource(record: TableRecord): string | undefined {
  return record.cell.kind === "user" ? record.cell.inputDetail : record.cell.outputDetail;
}

function detailTabs(record: TableRecord): readonly DetailTabItem[] {
  if (isMarkdownRecord(record)) {
    return [
      { id: "overview", labelKey: "tab.summary" },
      { id: "rendered", labelKey: "tab.preview" },
      { id: "raw", labelKey: "tab.raw" },
    ];
  }
  return [
    { id: "overview", labelKey: "tab.summary" },
    ...(record.cell.inputDetail ? [{ id: "input", labelKey: "tab.payload" } as const] : []),
    ...(record.cell.outputDetail ? [{ id: "output", labelKey: "tab.result" } as const] : []),
  ];
}

function recordDisplayText(cell: TrajectoryCellProps): string {
  if (cell.previewMarkdown !== undefined) {
    const preview = trajectoryPreviewText(cell.previewMarkdown);
    if (cell.text === "") return preview;
    return preview === "" ? cell.text : `${cell.text} · ${preview}`;
  }
  if (cell.text !== "") return cell.text;
  const markdown =
    cell.kind === "user"
      ? cell.inputDetail
      : cell.kind === "message"
        ? cell.outputDetail
        : undefined;
  return markdown === undefined ? "" : trajectoryPreviewText(markdown);
}

function recordResultText(cell: TrajectoryCellProps): string | undefined {
  return cell.resultPreviewMarkdown === undefined
    ? cell.result
    : trajectoryPreviewText(cell.resultPreviewMarkdown);
}

function toolCallTextParts(cell: TrajectoryCellProps, text: string): ToolCallTextParts | undefined {
  if (cell.kind !== "tool" && cell.kind !== "subtool") return undefined;
  const separator = text.indexOf(" · ");
  if (separator === -1) return { name: text };
  return {
    name: text.slice(0, separator),
    args: text.slice(separator + 3),
  };
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

function MarkdownFragment({
  text,
  rendered,
  preview,
}: {
  text: string;
  rendered: boolean;
  preview: boolean;
}) {
  if (rendered) {
    return (
      <div className={preview ? css.markdownPreview : css.markdownPayload}>
        <MarkdownText text={text} />
      </div>
    );
  }
  return <pre className={`${css.payload} ${preview ? css.payloadPreview : ""}`}>{text}</pre>;
}

function MarkdownRecordContent({
  record,
  rendered,
  preview = false,
  t,
}: {
  record: TableRecord;
  rendered: boolean;
  preview?: boolean;
  t: TrajectoryTranslate;
}) {
  const source = markdownSource(record);
  if (!source) return <p className={css.noPayload}>{record.cell.text || t("record.noContent")}</p>;
  return <MarkdownFragment text={source} rendered={rendered} preview={preview} />;
}

function parseJsonContainer(value: string): object | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function RecordPayload({
  record,
  direction,
  preview = false,
  t,
}: {
  record: TableRecord;
  direction: "input" | "output";
  preview?: boolean;
  t: TrajectoryTranslate;
}) {
  const value = direction === "input" ? record.cell.inputDetail : record.cell.outputDetail;
  if (!value) {
    return (
      <p className={css.noPayload}>
        {direction === "input" ? t("record.noPayload") : t("record.noResult")}
      </p>
    );
  }
  const error = direction === "output" && record.cell.isError === true;
  const payloadClass = preview ? css.jsonPreview : css.jsonPayload;
  const json = parseJsonContainer(value);
  if (json !== undefined) {
    return (
      <JsonTree
        data={json}
        className={error ? `${payloadClass} ${css.errorPayload}` : payloadClass}
      />
    );
  }
  return (
    <pre
      className={[
        css.payload,
        preview ? css.payloadPreview : undefined,
        error ? css.errorPayload : undefined,
      ]
        .filter((className): className is string => className !== undefined)
        .join(" ")}
    >
      {value}
    </pre>
  );
}

function OverviewSection({
  label,
  onOpen,
  children,
}: {
  label: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const measureOverflow = useCallback((preview: HTMLElement) => {
    setHasMore(preview.scrollHeight - preview.clientHeight - preview.scrollTop > 1);
  }, []);

  useLayoutEffect(() => {
    const preview = previewRef.current as HTMLDivElement;
    const measure = () => {
      measureOverflow(preview);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(preview);
    for (const child of preview.children) observer.observe(child);
    return () => {
      observer.disconnect();
    };
  }, [children, measureOverflow]);

  return (
    <section className={css.overviewSection}>
      <h3 className={css.overviewHeading}>
        <button type="button" className={css.overviewTitle} onClick={onOpen}>
          <span>{label}</span>
          <IconChevronRightOutlineRegular className={css.overviewTitleIcon} size={12} />
        </button>
      </h3>
      <div
        ref={previewRef}
        className={`${css.overviewPreview} ${css.summaryScrollRegion}`}
        data-summary-scroll-region=""
        data-scroll-more={hasMore || undefined}
        onScroll={(event) => {
          measureOverflow(event.currentTarget);
        }}
      >
        {children}
      </div>
    </section>
  );
}

function HierarchyLink({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button type="button" className={css.overviewHierarchyNavLink} onClick={onOpen}>
      <span>{label}</span>
      <IconChevronRightOutlineRegular className={css.overviewHierarchyJumpIconTight} size={11} />
    </button>
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
}: TrajectoryTableProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedStepIdentity, setSelectedStepIdentity] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [detailsWidth, setDetailsWidth] = useState<number | null>(null);
  const [toolRequestOffset, setToolRequestOffset] = useState<number | null>(null);
  const detailsResizeDrag = useRef<DetailsResizeDrag | null>(null);
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
  const projectedVirtualRows = useMemo(() => groupTrajectoryVirtualRows(records), [records]);
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
  const selectedState = selected === undefined ? undefined : stateOf(selected);
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
  const selectedStepAssistant = selectedStepRecords.find(
    (record) => record.cell.kind === "message",
  );
  const selectedStepToolCalls = selectedStepRecords.filter(
    (record) => record.cell.kind === "tool",
  ).length;
  const selectedStepSubtoolCalls = selectedStepRecords.filter(
    (record) => record.cell.kind === "subtool",
  ).length;
  const activeTurn = selectedStepInfo === undefined ? selected?.turn : selectedStepInfo.turn;
  const activeSection =
    selectedStepInfo === undefined ? selected?.section : selectedStepRecords[0]?.section;
  const selectedTabs =
    selectedStepInfo !== undefined ? STEP_TABS : selected === undefined ? [] : detailTabs(selected);
  const selectedParentTool = selected === undefined ? undefined : parentTool(allRecords, selected);
  const selectedAssistantStep =
    selected?.cell.kind === "message"
      ? stepsByKey.get(stepKey(selected.turn, selected.group))
      : undefined;
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
      {(selectedStepInfo !== undefined ||
        (selected !== undefined && selectedState !== undefined)) && (
        <aside
          className={css.details}
          aria-label={t("details.event")}
          style={detailsWidth === null ? undefined : { width: detailsWidth }}
        >
          <div
            className={css.detailsResizeHandle}
            role="separator"
            aria-label={t("details.resize")}
            aria-controls="trajectory-detail-panel"
            aria-orientation="vertical"
            tabIndex={0}
            onDoubleClick={() => {
              setDetailsWidth(null);
              setToolRequestOffset(null);
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              const details = event.currentTarget.parentElement;
              const split = details?.parentElement;
              if (
                details === null ||
                details === undefined ||
                split === null ||
                split === undefined
              )
                return;
              const splitWidth = split.getBoundingClientRect().width;
              detailsResizeDrag.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startWidth: details.getBoundingClientRect().width,
                splitWidth,
                startToolRequestOffset:
                  toolRequestOffset ??
                  splitWidth * TOOL_REQUEST_SHARE - defaultToolRequestWidth(splitWidth),
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              event.preventDefault();
            }}
            onPointerMove={(event) => {
              const drag = detailsResizeDrag.current;
              if (drag === null || drag.pointerId !== event.pointerId) return;
              const nextDetailsWidth = clampDetailsWidth(
                drag.startWidth + drag.startX - event.clientX,
                drag.splitWidth,
              );
              setDetailsWidth(nextDetailsWidth);
              setToolRequestOffset(
                drag.startToolRequestOffset +
                  (nextDetailsWidth - drag.startWidth) * TOOL_REQUEST_SHARE,
              );
            }}
            onPointerUp={(event) => {
              if (detailsResizeDrag.current?.pointerId !== event.pointerId) return;
              detailsResizeDrag.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              detailsResizeDrag.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              const details = event.currentTarget.parentElement;
              const split = details?.parentElement;
              if (
                details === null ||
                details === undefined ||
                split === null ||
                split === undefined
              )
                return;
              const direction = event.key === "ArrowLeft" ? 1 : -1;
              const currentDetailsWidth = details.getBoundingClientRect().width;
              const splitWidth = split.getBoundingClientRect().width;
              const nextDetailsWidth = clampDetailsWidth(
                currentDetailsWidth + direction * DETAILS_RESIZE_STEP,
                splitWidth,
              );
              const currentToolRequestOffset =
                toolRequestOffset ??
                splitWidth * TOOL_REQUEST_SHARE - defaultToolRequestWidth(splitWidth);
              setDetailsWidth(nextDetailsWidth);
              setToolRequestOffset(
                currentToolRequestOffset +
                  (nextDetailsWidth - currentDetailsWidth) * TOOL_REQUEST_SHARE,
              );
              event.preventDefault();
            }}
          />
          <div className={css.detailsHeader}>
            <div className={css.detailsTitle}>
              {selectedStepInfo !== undefined ? (
                <>
                  <span className={css.stepDetailsDot} aria-hidden="true" />
                  <span className={css.stepDetailsName}>
                    {t("step.label", { step: selectedStepInfo.step })}
                  </span>
                  <span className={css.detailsLocation}>
                    {sectionLabel(selectedStepInfo.turn, t)}
                  </span>
                </>
              ) : (
                selected !== undefined && (
                  <>
                    <span className={`${css.kindTag} ${KIND_TAG_CLASS[selected.cell.kind]}`}>
                      {t(KIND_LABEL_KEY[selected.cell.kind])}
                    </span>
                    <span className={css.detailsLocation}>
                      {`${sectionLabel(selected.turn, t)} · ${selected.group}`}
                    </span>
                  </>
                )
              )}
            </div>
            <button
              type="button"
              className={css.close}
              aria-label={t("details.close")}
              onClick={closeInspector}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className={css.detailTabs} role="tablist" aria-label={t("details.event")}>
            {selectedTabs.map((tab) => (
              <button
                key={tab.id}
                id={`trajectory-detail-${tab.id}`}
                type="button"
                role="tab"
                aria-controls="trajectory-detail-panel"
                aria-selected={activeTab === tab.id}
                className={
                  activeTab === tab.id ? `${css.detailTab} ${css.detailTabActive}` : css.detailTab
                }
                onClick={() => {
                  activateTab(tab.id);
                }}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
          <div
            id="trajectory-detail-panel"
            className={
              activeTab === "overview"
                ? `${css.detailBody} ${css.detailBodySummary}`
                : css.detailBody
            }
            role="tabpanel"
            aria-labelledby={`trajectory-detail-${activeTab}`}
          >
            {selectedStepInfo !== undefined && activeTab === "overview" && (
              <dl
                className={`${css.overview} ${css.summaryScrollRegion}`}
                data-summary-scroll-region=""
              >
                <div>
                  <dt>{t("details.status")}</dt>
                  <dd className={selectedStepInfo.status === "error" ? css.error : undefined}>
                    {statusLabel(selectedStepInfo.status, t)}
                  </dd>
                </div>
                <div>
                  <dt>{t("details.toolCalls")}</dt>
                  <dd>{selectedStepToolCalls}</dd>
                </div>
                {selectedStepSubtoolCalls > 0 && (
                  <div>
                    <dt>{t("details.subtoolCalls")}</dt>
                    <dd>{selectedStepSubtoolCalls}</dd>
                  </div>
                )}
                {selectedStepAssistant !== undefined && (
                  <div>
                    <dt>{t("details.result")}</dt>
                    <dd className={css.overviewParentLinks}>
                      <HierarchyLink
                        label={t("details.assistantMessage")}
                        onOpen={() => {
                          openRecordSummary(selectedStepAssistant);
                        }}
                      />
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {selected !== undefined && selectedState !== undefined && activeTab === "overview" && (
              <>
                <dl
                  className={`${css.overview} ${css.summaryScrollRegion}`}
                  data-summary-scroll-region=""
                >
                  {(selectedAssistantStep !== undefined || selectedParentTool !== undefined) && (
                    <div>
                      <dt>{t("details.hierarchy")}</dt>
                      <dd className={css.overviewParentLinks}>
                        {selectedAssistantStep !== undefined && (
                          <HierarchyLink
                            label={t("step.label", { step: selectedAssistantStep.step })}
                            onOpen={() => {
                              selectStep(selectedAssistantStep);
                            }}
                          />
                        )}
                        {selectedParentTool !== undefined && (
                          <HierarchyLink
                            label={t("details.toolCall")}
                            onOpen={() => {
                              openRecordSummary(selectedParentTool);
                            }}
                          />
                        )}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>{t("details.status")}</dt>
                    <dd className={selectedState === "error" ? css.error : undefined}>
                      {statusLabel(selectedState, t)}
                    </dd>
                  </div>
                </dl>
                <div className={css.overviewSections}>
                  {isMarkdownRecord(selected) ? (
                    <OverviewSection
                      label={t("tab.preview")}
                      onOpen={() => {
                        activateTab("rendered");
                      }}
                    >
                      <MarkdownRecordContent record={selected} rendered preview t={t} />
                    </OverviewSection>
                  ) : (
                    <>
                      {selected.cell.inputDetail && (
                        <OverviewSection
                          label={t("tab.payload")}
                          onOpen={() => {
                            activateTab("input");
                          }}
                        >
                          <RecordPayload record={selected} direction="input" preview t={t} />
                        </OverviewSection>
                      )}
                      {selected.cell.outputDetail && (
                        <OverviewSection
                          label={t("tab.result")}
                          onOpen={() => {
                            activateTab("output");
                          }}
                        >
                          <RecordPayload record={selected} direction="output" preview t={t} />
                        </OverviewSection>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
            {selected !== undefined && activeTab === "rendered" && (
              <MarkdownRecordContent record={selected} rendered t={t} />
            )}
            {selected !== undefined && activeTab === "raw" && (
              <MarkdownRecordContent record={selected} rendered={false} t={t} />
            )}
            {selected !== undefined && activeTab === "input" && (
              <RecordPayload record={selected} direction="input" t={t} />
            )}
            {selected !== undefined && activeTab === "output" && (
              <RecordPayload record={selected} direction="output" t={t} />
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
