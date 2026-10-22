import { AGENT_NAMES, type AssistantId, type AssistantNames } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { useSettings } from "@/components/account/SettingsProvider";
import { translate, type AppLocale } from "@/lib/i18n/locale";
import { ASSISTANT_ROLE_KEYS } from "./assistants";

export const ASSISTANT_ORDER: AssistantId[] = ["coordinator", ...AGENT_NAMES];

export function assistantName(
  id: AssistantId,
  names: AssistantNames | undefined,
  locale: AppLocale,
) {
  return names?.[id] ?? translate(locale, ASSISTANT_ROLE_KEYS[id]);
}

export function nameTaken(id: AssistantId, value: string, names: AssistantNames | undefined) {
  const wanted = value.trim().toLowerCase();
  return ASSISTANT_ORDER.some(
    (other) =>
      other !== id &&
      [
        names?.[other],
        translate("en", ASSISTANT_ROLE_KEYS[other]),
        translate("zh", ASSISTANT_ROLE_KEYS[other]),
      ].some((taken) => taken?.toLowerCase() === wanted),
  );
}

export function useAssistantName() {
  const { locale } = useLocale();
  const { settings } = useSettings();
  return (id: AssistantId) => assistantName(id, settings.assistant.names, locale);
}
