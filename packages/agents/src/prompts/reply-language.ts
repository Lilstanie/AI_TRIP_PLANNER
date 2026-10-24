import type { InterfaceLanguage } from "@trip/shared";

const LANGUAGE_NAME: Record<InterfaceLanguage, string> = {
  en: "English",
  zh: "Simplified Chinese",
};

export function replyLanguageRule(language: InterfaceLanguage | undefined): string {
  return language
    ? `\n\nReply language: write every sentence the traveller reads in ${LANGUAGE_NAME[language]}. Copy candidate and place names, ids, dates, codes and amounts exactly as given; never translate them.`
    : "";
}
