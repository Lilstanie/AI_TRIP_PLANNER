"use client";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocale } from "@/components/account/LocaleProvider";
import { intlLocale } from "@/lib/i18n/locale";
import { ChevronIcon, SendIcon } from "../ui/icons";

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
    <section className="trip-home-chats" aria-label={t("Chats")}>
      <h2 className="trip-home-chats__title">{`${t("Chats")} · ${chats.length}`}</h2>
      <ul className="trip-home-chats__list" aria-label={t("Chats")}>
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
  onSend(text: string): boolean;
}) {
  const { t } = useLocale();
  const [text, setText] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || disabled || !onSend(message)) return;
    setText("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    event.preventDefault();
    const message = text.trim();
    if (!message || disabled || !onSend(message)) return;
    setText("");
  };
  return (
    <form className="trip-home__composer-form" onSubmit={submit}>
      <textarea
        rows={1}
        value={text}
        aria-label={t("New chat")}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <button type="submit" aria-label={t("Send")} disabled={disabled || !text.trim()}>
        <SendIcon />
      </button>
    </form>
  );
}
