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

export function withVisiblePlaceholders(text: MessageKey, params: MessageParams): MessageParams {
  const filled = { ...params };
  for (const [, name] of en[text].matchAll(/\{([A-Za-z0-9]+)[,}]/g))
    if (!(name! in filled)) filled[name!] = `{${name}}`;
  return filled;
}

type Format = (key: string, values: MessageParams) => string;

const VALUE_START = "\uE000";
const VALUE_END = "\uE001";

export function fillMessage(
  locale: AppLocale,
  format: Format,
  text: MessageKey,
  params: MessageParams,
): string {
  const values = withVisiblePlaceholders(text, params);
  if (locale !== "zh") return format(text, values);
  const marked = Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      typeof value === "string" ? `${VALUE_START}${value}${VALUE_END}` : value,
    ]),
  );
  return format(text, marked)
    .replace(/(\p{Script=Han})\uE000(?=[A-Za-z0-9])/gu, "$1 ")
    .replace(/([A-Za-z0-9])\uE001(?=\p{Script=Han})/gu, "$1 ")
    .replace(/[\uE000\uE001]/g, "");
}

export function translate(locale: AppLocale, text: MessageKey, params: MessageParams = {}): string {
  return fillMessage(locale, translators[locale] as Format, text, params);
}

export type EnglishText = (typeof en)[MessageKey];

const keyOfText = new Map<string, MessageKey>();
for (const [key, text] of Object.entries(en) as [MessageKey, string][])
  if (!keyOfText.has(text)) keyOfText.set(text, key);

export function keyForText(text: EnglishText): MessageKey {
  return keyOfText.get(text)!;
}

export function keyForStoredText(text: string): MessageKey | undefined {
  return keyOfText.get(text);
}
