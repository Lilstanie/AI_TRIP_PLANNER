"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import {
  BookmarkIcon,
  ChatIcon,
  CloseIcon,
  GlobeIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
  SidebarIcon,
  SuitcaseIcon,
  UserIcon,
} from "../ui/icons";

/** A history row. Chats show only their title; trips add their dates and total as `subtitle`. */
export type HistoryItem = {
  id: string;
  title: string;
  subtitle?: string;
  status?: "Draft" | "Needs review";
  active?: boolean;
};

export type SidebarSection = "chats" | "trips";

function NavButton({
  icon,
  label,
  collapsed,
  count,
  current,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  count?: number;
  current?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      className={`sidebar-nav__item${current ? " is-current" : ""}`}
      aria-label={collapsed ? (count === undefined ? label : `${label}, ${count}`) : undefined}
      aria-current={current ? "true" : undefined}
      data-tooltip={collapsed ? label : undefined}
      onClick={onClick}
    >
      <span className="sidebar-nav__icon">{icon}</span>
      {!collapsed && <span className="sidebar-nav__label">{label}</span>}
      {!collapsed && count !== undefined && <span className="sidebar-nav__count">{count}</span>}
    </button>
  );
}

/**
 * The per-conversation overflow menu. Rename and Delete used to sit on every row, which made the
 * history noisy; they now open from one trigger. Escape closes the menu and hands focus back to the
 * trigger, and it is handled in the capture phase so it cannot also close an enclosing drawer.
 */
function HistoryMenu({
  title,
  onRename,
  onDelete,
}: {
  title: string;
  onRename(): void;
  onDelete(): void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);

  // Focus the first item so Escape and Tab start from inside the menu.
  useEffect(() => {
    if (open) firstItem.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) trigger.current?.focus({ preventScroll: true });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) close(false);
    };
    // Tabbing out of the menu closes it without stealing focus from wherever the user landed.
    const onFocusOut = (event: FocusEvent) => {
      if (!wrap.current?.contains(event.relatedTarget as Node | null)) close(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown);
    wrap.current?.addEventListener("focusout", onFocusOut);
    const element = wrap.current;
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown);
      element?.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  const act = (run: () => void) => {
    setOpen(false);
    run();
  };

  return (
    <div className="history-item__menu-wrap" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className="history-item__more"
        aria-label={`Actions for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="history-item__menu" role="menu" aria-label={`Actions for ${title}`}>
          <button ref={firstItem} type="button" role="menuitem" onClick={() => act(onRename)}>
            Rename
          </button>
          <button type="button" role="menuitem" onClick={() => act(onDelete)}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function WorkspaceSidebar({
  collapsed = false,
  collapsible = true,
  onToggleCollapsed,
  section,
  onSection,
  query,
  onQuery,
  chats,
  trips,
  savedCount,
  onNewChat,
  onOpenChat,
  onOpenTrip,
  onRenameChat,
  onDeleteChat,
  onSavedTrips,
  onLanguage,
  onAccount,
  saveState,
}: {
  collapsed?: boolean;
  /** False when the sidebar is shown inside the narrow-screen navigation drawer. */
  collapsible?: boolean;
  onToggleCollapsed?(): void;
  section: SidebarSection;
  onSection(section: SidebarSection): void;
  query: string;
  onQuery(value: string): void;
  chats: HistoryItem[];
  trips: HistoryItem[];
  savedCount: number;
  onNewChat(): void;
  onOpenChat(id: string): void;
  onOpenTrip(id: string): void;
  onRenameChat(id: string): void;
  onDeleteChat(id: string): void;
  onSavedTrips(): void;
  onLanguage(): void;
  onAccount(): void;
  saveState: "saving" | "saved" | "failed";
}) {
  const isCollapsed = collapsible && collapsed;
  const search = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const focusSearch = useRef(false);

  useEffect(() => {
    if (isCollapsed || !focusSearch.current) return;
    focusSearch.current = false;
    search.current?.focus();
  }, [isCollapsed]);

  /** Collapsed icons expand the sidebar so the chosen section's history is visible. */
  const reveal = (next?: SidebarSection) => {
    if (next) onSection(next);
    if (isCollapsed) onToggleCollapsed?.();
  };

  const items = section === "chats" ? chats : trips;

  return (
    <aside
      className={`workspace-sidebar${isCollapsed ? " is-collapsed" : ""}`}
      aria-label="Chats and trips"
    >
      <div className="sidebar-head">
        <BrandMark showName={!isCollapsed} />
        {collapsible && (
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            data-tooltip={isCollapsed ? "Expand sidebar" : undefined}
            onClick={onToggleCollapsed}
          >
            <SidebarIcon />
          </button>
        )}
      </div>

      <div className="sidebar-actions">
        <button
          type="button"
          className="sidebar-new-chat"
          aria-label={isCollapsed ? "New chat" : undefined}
          data-tooltip={isCollapsed ? "New chat" : undefined}
          onClick={onNewChat}
        >
          <PlusIcon />
          {!isCollapsed && <span>New chat</span>}
        </button>
        {isCollapsed ? (
          <NavButton
            icon={<SearchIcon />}
            label="Search chats and trips"
            collapsed
            onClick={() => {
              focusSearch.current = true;
              reveal();
            }}
          />
        ) : (
          <div className="sidebar-search">
            <SearchIcon />
            <label className="sr-only" htmlFor={searchId}>
              Search chats and trips
            </label>
            <input
              ref={search}
              id={searchId}
              className="field sidebar-search__input"
              type="search"
              placeholder="Search"
              autoComplete="off"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                className="sidebar-search__clear"
                aria-label="Clear search"
                onClick={() => {
                  onQuery("");
                  search.current?.focus();
                }}
              >
                <CloseIcon />
              </button>
            )}
          </div>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Workspace">
        <NavButton
          icon={<ChatIcon filled={section === "chats"} />}
          label="Chats"
          collapsed={isCollapsed}
          count={chats.length}
          current={section === "chats"}
          onClick={() => reveal("chats")}
        />
        <NavButton
          icon={<SuitcaseIcon filled={section === "trips"} />}
          label="Trips"
          collapsed={isCollapsed}
          count={trips.length}
          current={section === "trips"}
          onClick={() => reveal("trips")}
        />
        <NavButton
          icon={<BookmarkIcon />}
          label="Saved trips"
          collapsed={isCollapsed}
          count={savedCount}
          onClick={onSavedTrips}
        />
      </nav>

      {!isCollapsed && (
        <section className="sidebar-history" aria-label={section === "chats" ? "Chats" : "Trips"}>
          <h2 className="sidebar-history__title">
            {section === "chats" ? "Recent chats" : "Your trips"}
          </h2>
          <div className="history-list">
            {items.map((item) => (
              <article
                className={`history-item${item.active ? " history-item--active" : ""}`}
                key={item.id}
              >
                <button
                  type="button"
                  className="history-item__open"
                  aria-current={item.active ? "true" : undefined}
                  title={item.title}
                  onClick={() => (section === "chats" ? onOpenChat : onOpenTrip)(item.id)}
                >
                  <span className="history-item__title">{item.title}</span>
                  {item.subtitle && (
                    <span className="history-item__meta">
                      {item.status ? `${item.status} · ${item.subtitle}` : item.subtitle}
                    </span>
                  )}
                </button>
                {section === "chats" && (
                  <HistoryMenu
                    title={item.title}
                    onRename={() => onRenameChat(item.id)}
                    onDelete={() => onDeleteChat(item.id)}
                  />
                )}
              </article>
            ))}
            {!items.length && (
              <p className="history-empty">
                {query.trim()
                  ? "No matching records."
                  : section === "chats"
                    ? "No chats yet."
                    : "No trips yet. Plans you create appear here."}
              </p>
            )}
          </div>
        </section>
      )}

      <div className="sidebar-footer">
        {!isCollapsed && (
          <span className={`save-state save-state--${saveState}`} role="status">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "failed"
                ? "Save failed"
                : "Saved locally"}
          </span>
        )}
        <div className="sidebar-footer__actions">
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label="Language: English"
            data-tooltip={isCollapsed ? "Language" : undefined}
            onClick={onLanguage}
          >
            <GlobeIcon />
            {!isCollapsed && <span>EN</span>}
          </button>
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label="Local account"
            data-tooltip={isCollapsed ? "Local account" : undefined}
            onClick={onAccount}
          >
            <UserIcon />
            {!isCollapsed && <span>Local</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
