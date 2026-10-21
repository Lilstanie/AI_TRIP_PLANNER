import type { InterfaceLanguage } from "@trip/shared";

export function replyLanguage(
  message: string,
  interfaceLanguage: InterfaceLanguage | undefined,
): InterfaceLanguage {
  if (/\p{Script=Han}/u.test(message)) return "zh";
  if (/\p{Script=Latin}/u.test(message)) return "en";
  return interfaceLanguage ?? "en";
}
