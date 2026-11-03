import { AGENT_NAMES, planIssueCopy, type AgentName } from "@trip/shared";
import { translate, type AppLocale } from "@/lib/i18n/locale";
import { labels } from "./thinking-model";

const agent = (name: string) =>
  (AGENT_NAMES as readonly string[]).includes(name)
    ? translate("zh", labels[name as AgentName])
    : name;

export function constraintCopy(constraint: string, locale: AppLocale): string {
  return planIssueCopy(constraint, locale, agent);
}
