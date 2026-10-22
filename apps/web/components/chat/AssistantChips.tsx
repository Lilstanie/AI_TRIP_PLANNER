"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { AssistantIcon } from "./assistants";
import { ASSISTANT_ORDER, useAssistantName } from "./assistant-names";
import { insertMention, mentionToken } from "./mentions";

export function AssistantChips({
  value,
  onInput,
  disabled,
}: {
  value: string;
  onInput: (value: string) => void;
  disabled: boolean;
}) {
  const { t } = useLocale();
  const name = useAssistantName();
  return (
    <div className="assistant-chips" role="group" aria-label={t("Assistants")}>
      {ASSISTANT_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className="assistant-chip"
          disabled={disabled}
          aria-label={t("Mention {name}", { name: name(id) })}
          onClick={() => onInput(insertMention(value, mentionToken(name(id))))}
        >
          <AssistantIcon id={id} />
          <span>{name(id)}</span>
        </button>
      ))}
    </div>
  );
}
