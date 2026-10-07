import { translate, type AppLocale, type MessageKey } from "./locale";

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
