import { AUTHORED_KEYS, translate, type AppLocale, type MessageKey } from "./locale";

type Placeholders<Key extends string> = Key extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never;

export type NoticeValue = string | number | Notice;

type KeyedNotice = {
  [Key in MessageKey]: [Placeholders<Key>] extends [never]
    ? { key: Key; params?: never }
    : { key: Key; params: Record<Placeholders<Key>, NoticeValue> };
}[MessageKey];

export type Notice = KeyedNotice | { raw: string };

export function noticeText(locale: AppLocale, notice: Notice): string {
  if ("raw" in notice) return notice.raw;
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(notice.params ?? {}) as [string, NoticeValue][])
    params[name] = typeof value === "object" ? noticeText(locale, value) : value;
  return translate(locale, notice.key, params);
}

export class NoticeError extends Error {
  constructor(readonly notice: Notice) {
    super(noticeText("en", notice));
    this.name = "NoticeError";
  }
}

export const noticeBody = (notice: Notice) => ({ error: noticeText("en", notice), notice });

export function failureNotice(body: unknown, fallback: Notice): Notice {
  if (!body || typeof body !== "object") return fallback;
  const { notice, error } = body as { notice?: unknown; error?: unknown };
  if (notice && typeof notice === "object") {
    if (typeof (notice as { key?: unknown }).key === "string") return notice as Notice;
    if (typeof (notice as { raw?: unknown }).raw === "string") return notice as Notice;
  }
  return typeof error === "string" && error ? { raw: error } : fallback;
}

export const errorNotice = (error: unknown, fallback: Notice): Notice =>
  error instanceof NoticeError
    ? error.notice
    : error instanceof Error
      ? { raw: error.message }
      : fallback;

type AuthoredPattern = { key: MessageKey; names: string[]; sentence: RegExp };
let authoredPatterns: AuthoredPattern[] | undefined;

function patternsOf(): AuthoredPattern[] {
  authoredPatterns ??= AUTHORED_KEYS.map((key) => {
    const names: string[] = [];
    const source = key
      .split(/(\{[A-Za-z]+\})/)
      .map((part) => {
        const placeholder = /^\{([A-Za-z]+)\}$/.exec(part);
        if (!placeholder) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        names.push(placeholder[1]!);
        return "(.+?)";
      })
      .join("");
    return { key, names, sentence: new RegExp(`^${source}$`) };
  });
  return authoredPatterns;
}

export function keyOfAuthoredSentence(sentence: string): Notice | undefined {
  for (const { key, names, sentence: pattern } of patternsOf()) {
    const match = pattern.exec(sentence);
    if (!match) continue;
    if (!names.length) return { key } as Notice;
    const params = Object.fromEntries(names.map((name, index) => [name, match[index + 1]!]));
    return { key, params } as Notice;
  }
  return undefined;
}

const STORED_PREFIX = "notice:";

export function storeNotice(notice: Notice): string {
  return STORED_PREFIX + encodeURIComponent(JSON.stringify(notice));
}

export function readStoredNotice(text: string): Notice {
  if (text.startsWith(STORED_PREFIX)) {
    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(text.slice(STORED_PREFIX.length)));
      if (parsed && typeof parsed === "object") {
        if (typeof (parsed as { key?: unknown }).key === "string") return parsed as Notice;
        if (typeof (parsed as { raw?: unknown }).raw === "string") return parsed as Notice;
      }
    } catch {}
  }
  return { raw: text };
}
