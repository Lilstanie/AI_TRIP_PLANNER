import type { InterfaceLanguage } from "@trip/shared";

export function replyLanguage(
  message: string,
  interfaceLanguage: InterfaceLanguage | undefined,
): InterfaceLanguage {
  if (/\p{Script=Han}/u.test(message)) return "zh";
  if ((message.match(/\p{Script=Latin}+/gu) ?? []).length > 2) return "en";
  return interfaceLanguage ?? "en";
}
