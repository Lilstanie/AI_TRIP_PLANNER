/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

import type { TrajectoryTurnModel } from "./layout";
import type { TrajectoryCellProps } from "./trajectory-record";
import { trajectoryRecordId } from "./trajectory-record";
import { trajectoryPreviewText } from "./trajectory-preview";

interface SearchEntry {
  readonly sources: readonly string[];
  readonly text: string;
}

function sameSources(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function markdownPreview(cell: TrajectoryCellProps): string {
  if (cell.previewMarkdown === undefined) return "";
  const preview = trajectoryPreviewText(cell.previewMarkdown);
  if (cell.text === "") return preview;
  return preview === "" ? cell.text : `${cell.text} · ${preview}`;
}

function resultPreview(cell: TrajectoryCellProps): string {
  return cell.resultPreviewMarkdown === undefined
    ? (cell.result ?? "")
    : trajectoryPreviewText(cell.resultPreviewMarkdown);
}

function recordSources(
  turn: number | null,
  group: string,
  cell: TrajectoryCellProps,
): readonly string[] {
  const blocks = cell.sourceBlocks ?? [];
  return [
    turn === null ? "between turns" : `turn ${turn}`,
    group,
    cell.kind,
    cell.kind === "message" ? "assistant" : "",
    cell.text,
    cell.previewMarkdown ?? "",
    cell.inputDetail ?? "",
    cell.outputDetail ?? "",
    cell.thinkingDetail ?? "",
    cell.result ?? "",
    cell.resultPreviewMarkdown ?? "",
    cell.callId ?? "",
    ...blocks.flatMap((block) => [
      block.type,
      block.content,
      block.callId ?? "",
      block.toolName ?? "",
    ]),
  ];
}

export class TrajectorySearchIndex {
  private readonly entries = new Map<string, SearchEntry>();
  private layouts: readonly (readonly TrajectoryTurnModel[])[] | undefined;

  update(layouts: readonly (readonly TrajectoryTurnModel[])[]): boolean {
    if (this.layouts === layouts) return false;
    this.layouts = layouts;
    const seen = new Set<string>();
    for (const turns of layouts) {
      for (const turn of turns) {
        for (const group of turn.groups) {
          for (const cell of group.cells) {
            const id = trajectoryRecordId(cell);
            const sources = recordSources(turn.turn, group.title, cell);
            const previous = this.entries.get(id);
            const entry =
              previous !== undefined && sameSources(previous.sources, sources)
                ? previous
                : {
                    sources,
                    text: [...sources, markdownPreview(cell), resultPreview(cell)]
                      .join("\n")
                      .toLocaleLowerCase(),
                  };
            this.entries.set(id, entry);
            seen.add(id);
          }
        }
      }
    }
    for (const id of this.entries.keys()) {
      if (!seen.has(id)) this.entries.delete(id);
    }
    return true;
  }

  search(query: string): ReadonlySet<string> | null {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return null;
    const matches = new Set<string>();
    for (const [id, entry] of this.entries) {
      if (terms.every((term) => entry.text.includes(term))) matches.add(id);
    }
    return matches;
  }
}
