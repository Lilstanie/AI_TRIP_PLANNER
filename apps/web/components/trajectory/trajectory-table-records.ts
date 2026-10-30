/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

import type { TrajectoryCellProps } from "./trajectory-record";
import { trajectoryRecordId } from "./trajectory-record";
import type { TrajectoryTurnModel } from "./layout";
import { trajectoryPreviewText } from "./trajectory-preview";
import type { TrajectoryKey, TrajectoryTranslate } from "./locales";

export interface TableRecord {
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

export type DetailTab = "overview" | "rendered" | "raw" | "input" | "output";
export type RecordState = "complete" | "running" | "error";

export interface DetailTabItem {
  id: DetailTab;
  labelKey: TrajectoryKey;
}

export interface ToolCallTextParts {
  name: string;
  args?: string;
}

export const STEP_TABS: readonly DetailTabItem[] = [{ id: "overview", labelKey: "tab.summary" }];

export interface TrajectoryStep {
  turn: number;
  step: number;
  group: string;
  status: "complete" | "running" | "error";
}

export function flattenRecords(turns: readonly TrajectoryTurnModel[]): TableRecord[] {
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

export function filterRecords(
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

export function stepKey(turn: number | null, group: string): string {
  return `${turn}\u0000${group}`;
}

export function stepIdentity(step: TrajectoryStep): string {
  return `${step.turn}\u0000${step.step}`;
}

export function indexStepBoundaries(
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

export function sectionLabel(turn: number | null, t: TrajectoryTranslate): string {
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

export function collapseTurnRecords(
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

export function assistantToolCalls(
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

export function collapseAssistantRecords(
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

export function stateOf(record: TableRecord): RecordState {
  if (record.cell.isError) return "error";
  return record.cell.running ? "running" : "complete";
}

export function statusLabel(state: RecordState, t: TrajectoryTranslate): string {
  if (state === "error") return t("status.failed");
  if (state === "running") return t("status.pending");
  return t("status.completed");
}

export function isMarkdownRecord(record: TableRecord): boolean {
  return record.cell.kind === "user" || record.cell.kind === "message";
}

export function parentTool(
  records: readonly TableRecord[],
  record: TableRecord,
): TableRecord | undefined {
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

export function markdownSource(record: TableRecord): string | undefined {
  return record.cell.kind === "user" ? record.cell.inputDetail : record.cell.outputDetail;
}

export function detailTabs(record: TableRecord): readonly DetailTabItem[] {
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

export function recordDisplayText(cell: TrajectoryCellProps): string {
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

export function recordResultText(cell: TrajectoryCellProps): string | undefined {
  return cell.resultPreviewMarkdown === undefined
    ? cell.result
    : trajectoryPreviewText(cell.resultPreviewMarkdown);
}

export function toolCallTextParts(
  cell: TrajectoryCellProps,
  text: string,
): ToolCallTextParts | undefined {
  if (cell.kind !== "tool" && cell.kind !== "subtool") return undefined;
  const separator = text.indexOf(" · ");
  if (separator === -1) return { name: text };
  return {
    name: text.slice(0, separator),
    args: text.slice(separator + 3),
  };
}
