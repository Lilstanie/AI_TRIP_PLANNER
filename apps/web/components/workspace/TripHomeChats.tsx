"use client";
import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/account/LocaleProvider";
import { intlLocale } from "@/lib/i18n/locale";

export type TripHomeChat = { id: string; title: string; updatedAt: string };

export function TripHomeChats({
  chats,
  onOpen,
  onStart,
}: {
  chats: readonly TripHomeChat[];
  onOpen(id: string): void;
  onStart(text: string): void;
}) {
  const { t, locale } = useLocale();
  const [text, setText] = useState("");
  const date = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" });
  const formatDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : date.format(parsed);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart(text.trim());
    setText("");
  };
  return (
    <section className="trip-home-chats" aria-label={t("Chats")}>
      {chats.length > 0 && (
        <>
          <h2 className="trip-home-chats__title">{t("Chats")}</h2>
          <ul className="trip-home-chats__list" aria-label={t("Chats")}>
            {chats.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  className="trip-home-chats__row"
                  onClick={() => onOpen(chat.id)}
                >
                  <span className="trip-home-chats__name">{chat.title}</span>
                  <time className="trip-home-chats__date" dateTime={chat.updatedAt}>
                    {formatDate(chat.updatedAt)}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <form className="trip-home-chats__box" onSubmit={submit}>
        <textarea
          rows={1}
          value={text}
          aria-label={t("New chat")}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit">{t("Start chat")}</button>
      </form>
    </section>
  );
}
