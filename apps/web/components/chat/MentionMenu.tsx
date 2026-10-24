"use client";
import type { AssistantId } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import { AssistantIcon } from "./assistants";

export type MentionEntry = { id: AssistantId; name: string; aliases: string[] };

export function MentionMenu({
  menuId,
  entries,
  activeIndex,
  onPick,
}: {
  menuId: string;
  entries: MentionEntry[];
  activeIndex: number;
  onPick: (entry: MentionEntry) => void;
}) {
  const { t } = useLocale();
  return (
    <ul id={menuId} className="mention-menu" role="listbox" aria-label={t("Assistants")}>
      {entries.map((entry, index) => (
        <li
          key={entry.id}
          id={`${menuId}-${entry.id}`}
          role="option"
          aria-selected={index === activeIndex}
          className="mention-menu__option"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(entry)}
        >
          <AssistantIcon id={entry.id} />
          <span>{entry.name}</span>
        </li>
      ))}
    </ul>
  );
}
