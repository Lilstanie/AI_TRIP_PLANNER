"use client";
import { useEffect, useRef, useState } from "react";
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
  const row = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const node = row.current;
    if (!node) return;
    const update = () => setMore(node.scrollLeft + node.clientWidth < node.scrollWidth - 1);
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", update);
    };
  }, []);
  return (
    <div
      ref={row}
      className="assistant-chips"
      role="group"
      aria-label={t("Assistants")}
      data-more={more || undefined}
    >
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
