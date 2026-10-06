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
