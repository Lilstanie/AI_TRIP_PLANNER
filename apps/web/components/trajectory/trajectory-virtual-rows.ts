/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

import type { TrajectoryCellProps } from "./trajectory-record";
import { trajectoryRecordId } from "./trajectory-record";

const CONTENT_ROW_HEIGHT = 30;
export const PHONE_CONTENT_ROW_HEIGHT = 56;
const COLLAPSED_SUMMARY_HEIGHT = 20;

export interface VirtualizableTrajectoryRecord {
  cell: TrajectoryCellProps;
  collapsedSummaryKind?: "turn" | "assistant";
}

export interface TrajectoryVirtualRowEntry<T extends VirtualizableTrajectoryRecord> {
  logicalIndex: number;
  record: T;
}

export interface TrajectoryVirtualRow<T extends VirtualizableTrajectoryRecord> {
  entries: readonly TrajectoryVirtualRowEntry<T>[];
  height: number;
  key: string;
}

export function trajectoryVirtualRecordKey(record: VirtualizableTrajectoryRecord): string {
  const identity = encodeURIComponent(trajectoryRecordId(record.cell));
  return record.collapsedSummaryKind === undefined
    ? identity
    : `${identity}\u0000summary\u0000${record.collapsedSummaryKind}`;
}

export function groupTrajectoryVirtualRows<T extends VirtualizableTrajectoryRecord>(
  records: readonly T[],
  contentRowHeight = CONTENT_ROW_HEIGHT,
): readonly TrajectoryVirtualRow<T>[] {
  return records.map((record, logicalIndex) => ({
    entries: [{ logicalIndex, record }],
    height: record.collapsedSummaryKind === undefined ? contentRowHeight : COLLAPSED_SUMMARY_HEIGHT,
    key: trajectoryVirtualRecordKey(record),
  }));
}
