"use client";
import { keyForText } from "@/lib/i18n/locale";
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
    title === "New chat" || title === "New trip" ? t(keyForText(title)) : title;
  const searchId = useId();
  const localSearch = useRef<HTMLInputElement | null>(null);
  const searching = query.trim() !== "";
  const nothingSaved =
    collectionActions && !searching && !trips.length && chats.every((item) => item.untouched);

  return (
    <div className="chats-panel__content">
      {!nothingSaved && (
        <div className="sidebar-search">
          <SearchIcon />
          <label className="sr-only" htmlFor={searchId}>
            {t("searchChatsAndTrips")}
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
            placeholder={t("searchTitle")}
            autoComplete="off"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              className="sidebar-search__clear"
              aria-label={t("clearSearch")}
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
            {t("trips")}
          </h2>
          {collectionActions && (
            <button type="button" className="chats-panel__action" onClick={onNewTrip}>
              <NewTripIcon />
              <span>{t("newTrip")}</span>
            </button>
          )}
        </div>
        <p className="sr-only" role="status" aria-live="polite" aria-label={t("tripSearchResults")}>
          {searching
            ? trips.length
              ? t("countTripsFound", {
                  count: trips.length,
                })
              : t("noMatchingTrips")
            : ""}
        </p>
        {deletedTrip && <TripUndo deleted={deletedTrip} />}
        {!nothingSaved &&
          (tripsContent ?? (
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
                  {searching ? t("noMatchingTrips") : t("noTripsYetStartOne")}
                </p>
              )}
            </div>
          ))}
      </section>

      <section className="chats-panel__section" aria-labelledby={`${searchId}-chats`}>
        <div className="chats-panel__section-head">
          <h2 className="sidebar-history__title" id={`${searchId}-chats`}>
            {t("chats")}
          </h2>
          {collectionActions && (
            <button type="button" className="chats-panel__action" onClick={onNewChat}>
              <ComposeIcon />
              <span>{t("newChat")}</span>
            </button>
          )}
        </div>
        <p className="sr-only" role="status" aria-live="polite" aria-label={t("chatSearchResults")}>
          {searching
            ? chats.length
              ? t("countChatsFound", {
                  count: chats.length,
                })
              : t("noMatchingChats")
            : ""}
        </p>
        {!nothingSaved && (
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
              <p className="history-empty">{searching ? t("noMatchingChats") : t("noChatsYet")}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
