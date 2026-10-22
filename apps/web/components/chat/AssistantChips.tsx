"use client";
import type { AgentName, AssistantId } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { AssistantIcon, ASSISTANT_ROLE_KEYS } from "./assistants";
import { labels } from "./thinking-model";
import { insertMention, mentionToken } from "./mentions";

const ASSISTANTS: AssistantId[] = ["coordinator", ...(Object.keys(labels) as AgentName[])];

export function AssistantChips({
  value,
  onInput,
  disabled,
}: {
  value: string;
  onInput: (value: string) => void;
  disabled: boolean;
}) {
  const { t, locale } = useLocale();
  return (
    <div className="assistant-chips" role="group" aria-label={t("Assistants")}>
      {ASSISTANTS.map((id) => (
        <button
          key={id}
          type="button"
          className="assistant-chip"
          disabled={disabled}
          aria-label={t("Mention {name}", { name: t(ASSISTANT_ROLE_KEYS[id]) })}
          onClick={() => onInput(insertMention(value, mentionToken(id, locale)))}
        >
          <AssistantIcon id={id} />
          <span>{t(ASSISTANT_ROLE_KEYS[id])}</span>
        </button>
      ))}
    </div>
  );
}
