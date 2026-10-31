"use client";
import { useRef, useState } from "react";
import { useLocale } from "@/components/account/LocaleProvider";
import { intlLocale } from "@/lib/i18n/locale";
import { ChevronIcon } from "../ui/icons";
import { Composer } from "../chat/Composer";
import type { PreparedAttachment } from "@/lib/chat/attachments";
import { useComposerAttachments } from "./useComposerAttachments";

export type TripHomeChat = { id: string; title: string; updatedAt: string };

export function TripHomeChats({
  chats,
  onOpen,
}: {
  chats: readonly TripHomeChat[];
  onOpen(id: string): void;
}) {
  const { t, locale } = useLocale();
  const date = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" });
  const formatDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : date.format(parsed);
  };
  if (!chats.length) return null;
  return (
    <section className="trip-home-chats" aria-label={t("chats")}>
      <h2 className="trip-home-chats__title">{`${t("chats")} · ${chats.length}`}</h2>
      <ul className="trip-home-chats__list" aria-label={t("chats")}>
        {chats.map((chat) => (
          <li key={chat.id}>
            <button type="button" className="trip-home-chats__row" onClick={() => onOpen(chat.id)}>
              <span className="trip-home-chats__name">{chat.title}</span>
              <span className="trip-home-chats__trailing">
                <time className="trip-home-chats__date" dateTime={chat.updatedAt}>
                  {formatDate(chat.updatedAt)}
                </time>
                <span className="trip-home-chats__chevron" aria-hidden="true">
                  <ChevronIcon />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TripHomeComposer({
  disabled = false,
  onSend,
}: {
  disabled?: boolean;
  onSend(text: string, attachments: PreparedAttachment[]): boolean;
}) {
  const { t } = useLocale();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const files = useComposerAttachments();

  const submit = () => {
    const message = text.trim();
    if ((!message && !files.attachments.length) || disabled) return;
    if (!onSend(message, files.attachments)) return;
    setText("");
    files.clearAttachments();
  };
  return (
    <div className="trip-home__composer-form">
      <Composer
        value={text}
        placeholder={t("tellMeWhatToChange")}
        busy={false}
        canSend={!disabled && (Boolean(text.trim()) || files.attachments.length > 0)}
        canCancel={false}
        inputRef={inputRef}
        onInput={setText}
        onSend={submit}
        onAttachFiles={files.addFiles}
        attachments={files.attachments}
        onRemoveAttachment={files.removeAttachment}
        canAttach={!disabled && files.canAttach}
        attachNotices={files.notices}
      />
    </div>
  );
}
