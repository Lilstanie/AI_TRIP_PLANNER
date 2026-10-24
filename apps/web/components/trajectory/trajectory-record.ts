/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

export type TrajectoryCellKind = "user" | "message" | "tool" | "subtool";

export interface TrajectorySourceBlock {
  type: string;
  content: string;
  callId?: string;
  toolName?: string;
}

export interface TrajectoryCellProps {
  index: number;
  recordId?: string;
  kind: TrajectoryCellKind;
  text: string;
  previewMarkdown?: string;
  sourceSeq?: number;
  inputDetail?: string;
  outputDetail?: string;
  thinkingDetail?: string;
  sourceBlocks?: readonly TrajectorySourceBlock[];
  result?: string;
  resultPreviewMarkdown?: string;
  callId?: string;
  toolName?: string;
  isError?: boolean;
  running?: boolean;
}

export function trajectoryRecordId(cell: TrajectoryCellProps): string {
  if (cell.recordId !== undefined) return cell.recordId;
  if (cell.callId !== undefined) return `${cell.kind}\u0000call\u0000${cell.callId}`;
  if (cell.sourceSeq !== undefined) return `${cell.kind}\u0000seq\u0000${cell.sourceSeq}`;
  return `${cell.kind}\u0000index\u0000${cell.index}`;
}
