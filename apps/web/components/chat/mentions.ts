import type { AgentName, AssistantId } from "@trip/shared";
import { translate } from "@/lib/i18n/locale";
import { ASSISTANT_ROLE_KEYS } from "./assistants";
import { labels } from "./thinking-model";

const SPECIALISTS = Object.keys(labels) as AgentName[];

function names(id: AgentName): string[] {
  return [translate("en", labels[id]), translate("zh", labels[id])];
}

export function mentionToken(id: AssistantId, locale: "en" | "zh"): string {
  return `@${translate(locale, ASSISTANT_ROLE_KEYS[id])}`;
}

export function insertMention(text: string, token: string): string {
  const separator = text && !/\s$/.test(text) ? " " : "";
  return `${text}${separator}${token} `;
}

export function resolveMentions(text: string): AgentName[] {
  const entries = SPECIALISTS.flatMap((id) => names(id).map((name) => ({ id, name })));
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
