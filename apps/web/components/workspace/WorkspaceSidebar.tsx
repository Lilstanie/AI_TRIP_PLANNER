"use client";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { BrandMark } from "./BrandMark";
import { ChatIcon, GlobeIcon, MoreIcon, SidebarIcon, SuitcaseIcon, UserIcon } from "../ui/icons";

/**
 * A history row. Chats show their title and, when they belong to a trip, that trip's name as
 * `subtitle`; trips add their dates and total as `subtitle` and their destination for the cover.
 */
export type HistoryItem = {
  id: string;
  title: string;
  subtitle?: string;
  status?: "Draft" | "Needs review";
  destination?: string;
  active?: boolean;
};

/** What the main area shows: the chat-and-map workspace, or the Your trips overview. */
export type WorkspacePage = "workspace" | "trips";

function NavButton({
  icon,
  label,
  collapsed,
  count,
  current,
  expanded,
  controls,
  buttonRef,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  count?: number;
  current?: boolean;
  /** Set for a button that opens a panel. */
  expanded?: boolean;
  controls?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  onClick(): void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
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
export function HistoryMenu({
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

/**
 * The navigation rail. Chats opens the Chats panel beside it (search, New chat, New trip and the
 * history), as Mindtrip's does; Trips opens the Your trips overview in the main area. On narrow
 * screens the sidebar sits in the navigation drawer and shows the Chats panel's content itself,
 * passed as `children`.
 */
export function WorkspaceSidebar({
  collapsed = false,
  collapsible = true,
  onToggleCollapsed,
  page,
  chatsOpen,
  chatCount,
  tripCount,
  onChats,
  onTrips,
  chatsButton,
  onLanguage,
  onAccount,
  saveState,
  children,
}: {
  collapsed?: boolean;
  /** False when the sidebar is shown inside the narrow-screen navigation drawer. */
  collapsible?: boolean;
  onToggleCollapsed?(): void;
  page: WorkspacePage;
  chatsOpen: boolean;
  chatCount: number;
  tripCount: number;
  /** Opens or closes the Chats panel. */
  onChats(): void;
  /** Shows the Your trips overview. */
  onTrips(): void;
  /** The Chats button, which the Chats panel returns focus to. */
  chatsButton?: Ref<HTMLButtonElement>;
  onLanguage(): void;
  onAccount(): void;
  saveState: "saving" | "saved" | "failed";
  children?: ReactNode;
}) {
  const isCollapsed = collapsible && collapsed;

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

      <nav className="sidebar-nav" aria-label="Workspace">
        {collapsible ? (
          <NavButton
            buttonRef={chatsButton}
            icon={<ChatIcon filled={chatsOpen} />}
            label="Chats"
            collapsed={isCollapsed}
            count={chatCount}
            current={chatsOpen}
            expanded={chatsOpen}
            controls="chats-panel"
            onClick={onChats}
          />
        ) : null}
        <NavButton
          icon={<SuitcaseIcon filled={page === "trips" && !chatsOpen} />}
          label="Trips"
          collapsed={isCollapsed}
          count={tripCount}
          current={page === "trips" && !chatsOpen}
          onClick={onTrips}
        />
      </nav>

      {children}

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
