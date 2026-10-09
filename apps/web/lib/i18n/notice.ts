import { AUTHORED_KEYS, translate, type AppLocale, type MessageKey } from "./locale";

/** The `{name}` placeholders of a dictionary key, as a union of names. */
type Placeholders<Key extends string> = Key extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never;

/** A value filled into a notice: plain text or a number, or another notice translated with it. */
export type NoticeValue = string | number | Notice;

type KeyedNotice = {
  [Key in MessageKey]: [Placeholders<Key>] extends [never]
    ? { key: Key; params?: never }
    : { key: Key; params: Record<Placeholders<Key>, NoticeValue> };
}[MessageKey];

/**
 * Something the app tells the traveller, carried untranslated until it is shown. A keyed notice
 * names a dictionary entry and the values for its placeholders; the compiler rejects a key with no
 * Chinese entry and a missing or unexpected value. `raw` is only for provider or model text, which
 * is shown exactly as received in every language.
 */
export type Notice = KeyedNotice | { raw: string };

/**
 * A notice in the interface language. A value missing at run time, as in a notice parsed from a
 * response, leaves its `{placeholder}` visible rather than writing `undefined`.
 */
export function noticeText(locale: AppLocale, notice: Notice): string {
  if ("raw" in notice) return notice.raw;
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(notice.params ?? {}) as [string, NoticeValue][])
    params[name] = typeof value === "object" ? noticeText(locale, value) : value;
  return translate(locale, notice.key, params);
}

/** An error for code that throws something the traveller should read; `message` stays English. */
export class NoticeError extends Error {
  constructor(readonly notice: Notice) {
    super(noticeText("en", notice));
    this.name = "NoticeError";
  }
}

/** A route's JSON failure body: English `error` for logs and older clients, plus the notice. */
export const noticeBody = (notice: Notice) => ({ error: noticeText("en", notice), notice });

/**
 * The notice to show for a failed response body. A route's keyed `notice` wins; an `error` with no
 * notice did not come from an authored producer and is shown as received; anything else, such as a
 * missing or malformed body, shows `fallback`.
 */
export function failureNotice(body: unknown, fallback: Notice): Notice {
  if (!body || typeof body !== "object") return fallback;
  const { notice, error } = body as { notice?: unknown; error?: unknown };
  if (notice && typeof notice === "object") {
    if (typeof (notice as { key?: unknown }).key === "string") return notice as Notice;
    if (typeof (notice as { raw?: unknown }).raw === "string") return notice as Notice;
  }
  return typeof error === "string" && error ? { raw: error } : fallback;
}

/**
 * The notice for something caught: an authored `NoticeError` keeps its notice, any other error is
 * shown exactly as raised, and a thrown non-error shows `fallback`.
 */
export const errorNotice = (error: unknown, fallback: Notice): Notice =>
  error instanceof NoticeError
    ? error.notice
    : error instanceof Error
      ? { raw: error.message }
      : fallback;

type AuthoredPattern = { key: MessageKey; names: string[]; sentence: RegExp };
let authoredPatterns: AuthoredPattern[] | undefined;

/** One pattern per English key: each `{name}` becomes a group, the rest of the key matches itself. */
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

/**
 * The notice an English sentence was built from, when the app wrote that sentence: each placeholder's value is read
 * back from it, so `Day 1: Park needs at least 35 minutes after the previous activity.` is the travel-buffer notice
 * with day 1, stop Park and 35 minutes. Undefined for any other text, which is then shown as received.
 */
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

/**
 * A notice kept on a plan. The plan stores strings (`editIssues[].message`, shared with packages/shared),
 * so a keyed notice is written as its key and params, encoded in one string, and read back in the
 * interface language. The English sentence stays in `conflictsWith`, which the chat reads.
 */
export function storeNotice(notice: Notice): string {
  return STORED_PREFIX + encodeURIComponent(JSON.stringify(notice));
}

/**
 * The notice a stored plan string holds. A string that was not written by `storeNotice` (a plan saved
 * before notices were keyed, or an agent's sentence) is shown as received, as `{ raw }`.
 */
export function readStoredNotice(text: string): Notice {
  if (text.startsWith(STORED_PREFIX)) {
    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(text.slice(STORED_PREFIX.length)));
      if (parsed && typeof parsed === "object") {
        if (typeof (parsed as { key?: unknown }).key === "string") return parsed as Notice;
        if (typeof (parsed as { raw?: unknown }).raw === "string") return parsed as Notice;
      }
    } catch {
      // Not a stored notice after all: shown as the text it is.
    }
  }
  return { raw: text };
}
