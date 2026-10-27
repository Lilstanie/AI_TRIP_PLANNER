"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useId, useRef, type Ref, type ReactNode } from "react";
import { CloseIcon, ComposeIcon, NewTripIcon, SearchIcon } from "../ui/icons";
import { HistoryMenu, type HistoryItem } from "./WorkspaceSidebar";
import { TripUndo, type DeletedTrip } from "./TripUndo";
import { TripCover } from "./TripCover";

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
  onRenameTrip,
  onDeleteTrip,
  deletedTrip,
  searchRef,
  tripsContent,
  collectionActions = false,
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
  onRenameTrip(id: string): void;
  onDeleteTrip(id: string): void;
  deletedTrip?: DeletedTrip;
  searchRef?: Ref<HTMLInputElement>;

  tripsContent?: ReactNode;
  collectionActions?: boolean;
}) {
  const { t } = useLocale();
  const chatTitle = (title: string) =>
    title === "New chat" || title === "New trip" ? t(title) : title;
  const searchId = useId();
  const localSearch = useRef<HTMLInputElement | null>(null);
  const searching = query.trim() !== "";
  const nothingSaved =
    collectionActions &&
    !searching &&
    !trips.length &&
    chats.every((item) => item.title === "New chat" && !item.subtitle);

  return (
    <div className="chats-panel__content">
      {!nothingSaved && (
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
      )}

      <section className="chats-panel__section" aria-labelledby={`${searchId}-trips`}>
        <div className="chats-panel__section-head">
          <h2 className="sidebar-history__title" id={`${searchId}-trips`}>
            {t("Trips")}
          </h2>
          {collectionActions && (
            <button type="button" className="chats-panel__action" onClick={onNewTrip}>
              <NewTripIcon />
              <span>{t("New trip")}</span>
            </button>
          )}
        </div>
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-label={t("Trip search results")}
        >
          {searching
            ? trips.length
              ? t(trips.length === 1 ? "{count} trip found" : "{count} trips found", {
                  count: trips.length,
                })
              : t("No matching trips.")
            : ""}
        </p>
        {deletedTrip && <TripUndo deleted={deletedTrip} />}
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
                <HistoryMenu
                  title={item.title}
                  onRename={() => onRenameTrip(item.id)}
                  onDelete={() => onDeleteTrip(item.id)}
                />
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

      {!nothingSaved && (
        <section className="chats-panel__section" aria-labelledby={`${searchId}-chats`}>
          <div className="chats-panel__section-head">
            <h2 className="sidebar-history__title" id={`${searchId}-chats`}>
              {t("Chats")}
            </h2>
            {collectionActions && (
              <button type="button" className="chats-panel__action" onClick={onNewChat}>
                <ComposeIcon />
                <span>{t("New chat")}</span>
              </button>
            )}
          </div>
          <p
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-label={t("Chat search results")}
          >
            {searching
              ? chats.length
                ? t(chats.length === 1 ? "{count} chat found" : "{count} chats found", {
                    count: chats.length,
                  })
                : t("No matching chats.")
              : ""}
          </p>
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
                  title={chatTitle(item.title)}
                  onClick={() => onOpenChat(item.id)}
                >
                  <span className="history-item__title">{chatTitle(item.title)}</span>
                  {item.subtitle && <span className="history-item__meta">{item.subtitle}</span>}
                </button>
                <HistoryMenu
                  title={chatTitle(item.title)}
                  subtitle={item.subtitle}
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
      )}
    </div>
  );
}
