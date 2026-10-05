"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useId, useRef, type Ref, type ReactNode } from "react";
import { CloseIcon, ComposeIcon, NewTripIcon, SearchIcon } from "../ui/icons";
import { HistoryMenu, type HistoryItem } from "./WorkspaceSidebar";
import { TripCover } from "./TripCover";

/**
 * Search, the two ways to start (New chat, New trip) and the history: trips first, then chats,
 * as in Mindtrip's chats panel. On desktop it slides out beside the sidebar; in the narrow
 * navigation drawer it sits under the sidebar's own navigation.
 */
export function ChatsPanel({
  query,
  onQuery,
  chats,
  trips,
  onNewChat,
  onNewTrip,
  onOpenChat,
  onOpenTrip,
  onRenameChat,
  onDeleteChat,
  searchRef,
  tripsContent,
}: {
  query: string;
  onQuery(value: string): void;
  chats: HistoryItem[];
  trips: HistoryItem[];
  onNewChat(): void;
  onNewTrip(): void;
  onOpenChat(id: string): void;
  onOpenTrip(id: string): void;
  onRenameChat(id: string): void;
  onDeleteChat(id: string): void;
  searchRef?: Ref<HTMLInputElement>;
  /** Mine embeds the Trips / Calendar view in the existing trip section. */
  tripsContent?: ReactNode;
}) {
  const { t } = useLocale();
  const searchId = useId();
  const localSearch = useRef<HTMLInputElement | null>(null);
  const searching = query.trim() !== "";

  return (
    <div className="chats-panel__content">
      <div className="sidebar-search">
        <SearchIcon />
        <label className="sr-only" htmlFor={searchId}>
          {t("Search chats and trips")}
        </label>
        <input
          ref={(node) => {
            localSearch.current = node;
            if (typeof searchRef === "function") searchRef(node);
            else if (searchRef) searchRef.current = node;
          }}
          id={searchId}
          className="field sidebar-search__input"
          type="search"
          placeholder={t("Search…")}
          autoComplete="off"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
        {query && (
          <button
            type="button"
            className="sidebar-search__clear"
            aria-label={t("Clear search")}
            onClick={() => {
              onQuery("");
              localSearch.current?.focus();
            }}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="chats-panel__actions">
        <button type="button" className="chats-panel__action" onClick={onNewChat}>
          <ComposeIcon />
          <span>{t("New chat")}</span>
        </button>
        <button type="button" className="chats-panel__action" onClick={onNewTrip}>
          <NewTripIcon />
          <span>{t("New trip")}</span>
        </button>
      </div>

      <section className="chats-panel__section" aria-labelledby={`${searchId}-trips`}>
        <h2 className="sidebar-history__title" id={`${searchId}-trips`}>
          {t("Trips")}
        </h2>
        {tripsContent ?? (
          <div className="history-list">
            {trips.map((item) => (
              <article
                className={`history-item history-item--trip${item.active ? " history-item--active" : ""}`}
                key={item.id}
              >
                <button
                  type="button"
                  className="history-item__open"
                  aria-current={item.active ? "true" : undefined}
                  title={item.title}
                  onClick={() => onOpenTrip(item.id)}
                >
                  <TripCover destination={item.destination ?? item.title} size="thumb" />
                  <span className="history-item__title">{item.title}</span>
                </button>
              </article>
            ))}
            {!trips.length && (
              <p className="history-empty">
                {searching ? t("No matching trips.") : t("No trips yet. Start one with New trip.")}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="chats-panel__section" aria-labelledby={`${searchId}-chats`}>
        <h2 className="sidebar-history__title" id={`${searchId}-chats`}>
          {t("Chats")}
        </h2>
        <div className="history-list">
          {chats.map((item) => (
            <article
              className={`history-item${item.active ? " history-item--active" : ""}`}
              key={item.id}
            >
              <button
                type="button"
                className="history-item__open"
                aria-current={item.active ? "true" : undefined}
                title={item.title}
                onClick={() => onOpenChat(item.id)}
              >
                <span className="history-item__title">{item.title}</span>
                {item.subtitle && <span className="history-item__meta">{item.subtitle}</span>}
              </button>
              <HistoryMenu
                title={item.title}
                onRename={() => onRenameChat(item.id)}
                onDelete={() => onDeleteChat(item.id)}
              />
            </article>
          ))}
          {!chats.length && (
            <p className="history-empty">
              {searching ? t("No matching chats.") : t("No chats yet.")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
