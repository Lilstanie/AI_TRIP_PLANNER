import type { AgentName, AssistantNames } from "@trip/shared";
import { translate } from "@/lib/i18n/locale";
import { labels } from "./thinking-model";

const SPECIALISTS = Object.keys(labels) as AgentName[];

function names(id: AgentName): string[] {
  return [translate("en", labels[id]), translate("zh", labels[id])];
}

export function mentionToken(name: string): string {
  return `@${name}`;
}

export function insertMention(text: string, token: string): string {
  const separator = text && !/\s$/.test(text) ? " " : "";
  return `${text}${separator}${token} `;
}

export type MentionQuery = { start: number; query: string };

export function activeMention(text: string, caret: number): MentionQuery | null {
  for (let index = caret - 1; index >= 0; index -= 1) {
    const char = text[index]!;
    if (/\s/.test(char)) return null;
    if (char !== "@") continue;
    if (index > 0 && !/\s/.test(text[index - 1]!)) return null;
    return { start: index, query: text.slice(index + 1, caret) };
  }
  return null;
}

export function matchesMention(query: string, candidates: readonly string[]): boolean {
  const wanted = query.toLowerCase();
  return candidates.some((name) => name.toLowerCase().startsWith(wanted));
}

export function mentionBefore(
  text: string,
  caret: number,
  known: readonly string[],
): [number, number] | null {
  const ends = /\s/.test(text[caret - 1] ?? "") ? [caret - 1, caret] : [caret];
  const sorted = [...known].sort((a, b) => b.length - a.length);
  for (const end of ends) {
    if (/[A-Za-z]/.test(text[end] ?? "")) continue;
    const before = text.slice(0, end).toLowerCase();
    for (const name of sorted) {
      const start = end - name.length - 1;
      if (start < 0 || before.slice(start) !== `@${name.toLowerCase()}`) continue;
      if (start > 0 && !/\s/.test(text[start - 1]!)) continue;
      return [start, end];
    }
  }
  return null;
}

export function resolveMentions(text: string, custom?: AssistantNames): AgentName[] {
  const entries = SPECIALISTS.flatMap((id) =>
    [...names(id), ...(custom?.[id] ? [custom[id]] : [])].map((name) => ({ id, name })),
  );
  entries.sort((a, b) => b.name.length - a.name.length);
  const escaped = entries.map(({ name }) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`@(${escaped.join("|")})(?![A-Za-z])`, "gi");
  const found: AgentName[] = [];
  for (const match of text.matchAll(pattern)) {
    const spoken = match[1]!.toLowerCase();
    const id = entries.find(({ name }) => name.toLowerCase() === spoken)?.id;
    if (id && !found.includes(id)) found.push(id);
  }
  return found;
}
