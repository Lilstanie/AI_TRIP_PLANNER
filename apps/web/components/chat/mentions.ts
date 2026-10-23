import type { AgentName, AssistantId, AssistantNames } from "@trip/shared";
import { translate } from "@/lib/i18n/locale";
import { ASSISTANT_ROLE_KEYS } from "./assistants";
import { labels } from "./thinking-model";

const SPECIALISTS = Object.keys(labels) as AgentName[];

export function roleNames(id: AssistantId): string[] {
  return [translate("en", ASSISTANT_ROLE_KEYS[id]), translate("zh", ASSISTANT_ROLE_KEYS[id])];
}

export function mentionToken(name: string): string {
  return `@${name}`;
}

export type MentionQuery = { start: number; query: string };

export function activeMention(
  text: string,
  caret: number,
  known: readonly string[],
): MentionQuery | null {
  const longest = Math.max(0, ...known.map((name) => name.length));
  for (let index = caret - 1; index >= 0 && caret - index <= longest + 1; index -= 1) {
    if (text[index] !== "@") continue;
    if (index > 0 && !/\s/.test(text[index - 1]!)) continue;
    const query = text.slice(index + 1, caret);
    if (!/\s/.test(query) || matchesMention(query, known)) return { start: index, query };
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
  const trailing = /\s/.test(text[caret - 1] ?? "");
  const ends = trailing ? [caret - 1, caret] : [caret];
  const sorted = [...known].sort((a, b) => b.length - a.length);
  for (const end of ends) {
    if (/[A-Za-z]/.test(text[end] ?? "")) continue;
    const before = text.slice(0, end).toLowerCase();
    for (const name of sorted) {
      const start = end - name.length - 1;
      if (start < 0 || before.slice(start) !== `@${name.toLowerCase()}`) continue;
      if (start > 0 && !/\s/.test(text[start - 1]!)) continue;
      return [start, caret];
    }
  }
  return null;
}

export function resolveMentions(text: string, custom?: AssistantNames): AgentName[] {
  const entries = SPECIALISTS.flatMap((id) =>
    [...roleNames(id), ...(custom?.[id] ? [custom[id]] : [])].map((name) => ({ id, name })),
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
