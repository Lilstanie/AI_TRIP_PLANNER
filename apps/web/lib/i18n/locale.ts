import { createTranslator } from "next-intl";
import { en } from "./messages/en";
import { zh } from "./messages/zh";

export const LOCALES = ["en", "zh"] as const;
export type AppLocale = (typeof LOCALES)[number];

export function browserLocale(languages: readonly string[]): AppLocale {
  return languages[0]?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export const intlLocale = (locale: AppLocale) => (locale === "zh" ? "zh-CN" : "en-AU");

export const MESSAGES = { en, zh } as const;

export type MessageKey = keyof typeof en;

export type MessageParams = Record<string, string | number>;

const translators = {
  en: createTranslator({ locale: "en", messages: en }),
  zh: createTranslator({ locale: "zh", messages: zh }),
};

/** Placeholders a caller leaves out stay visible as `{name}` instead of failing the whole message. */
export function withVisiblePlaceholders(text: MessageKey, params: MessageParams): MessageParams {
  const filled = { ...params };
  for (const [, name] of en[text].matchAll(/\{([A-Za-z0-9]+)[,}]/g))
    if (!(name! in filled)) filled[name!] = `{${name}}`;
  return filled;
}

export function translate(locale: AppLocale, text: MessageKey, params: MessageParams = {}): string {
  return (translators[locale] as (key: string, values: MessageParams) => string)(
    text,
    withVisiblePlaceholders(text, params),
  );
}

export type EnglishText = (typeof en)[MessageKey];

const keyOfText = new Map<string, MessageKey>();
for (const [key, text] of Object.entries(en) as [MessageKey, string][])
  if (!keyOfText.has(text)) keyOfText.set(text, key);

/** Message id for an English label that is also stored or compared as data, such as a saved interest. */
export function keyForText(text: EnglishText): MessageKey {
  return keyOfText.get(text)!;
}

/** Message id for stored English text, or `undefined` when no message has that exact English wording. */
export function keyForStoredText(text: string): MessageKey | undefined {
  return keyOfText.get(text);
}
