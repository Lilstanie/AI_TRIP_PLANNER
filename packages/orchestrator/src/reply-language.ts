import type { InterfaceLanguage } from "@trip/shared";

/** Resolves one turn's reply language: Han text is Chinese, Latin text is English, anything else, such as numbers, dates or an empty message, falls back to the interface language, then English. */
export function replyLanguage(
  message: string,
  interfaceLanguage: InterfaceLanguage | undefined,
): InterfaceLanguage {
  if (/\p{Script=Han}/u.test(message)) return "zh";
  if (/\p{Script=Latin}/u.test(message)) return "en";
  return interfaceLanguage ?? "en";
}
