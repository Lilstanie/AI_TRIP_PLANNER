"use client";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { BrandMark } from "./BrandMark";
import {
  CalendarIcon,
  ChatIcon,
  ComposeIcon,
  MoreIcon,
  LedgerIcon,
  SidebarIcon,
  SuitcaseIcon,
} from "../ui/icons";
import { AccountButton } from "../account/AccountButton";
import type { SettingsSection } from "../account/SettingsDialog";
import type { SyncStatus } from "../account/useAccountSync";
import { useLocale } from "../account/LocaleProvider";

export type HistoryItem = {
  id: string;
  title: string;
  subtitle?: string;
  destination?: string;
  active?: boolean;
  untouched?: boolean;
};

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

export function HistoryMenu({
  title,
  subtitle,
  onRename,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  onRename(): void;
  onDelete(): void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      menu.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
      firstItem.current?.focus({ preventScroll: true });
    }
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

  const label = subtitle
    ? t("actionsForV0V1", { v0: title, v1: subtitle })
    : t("actionsForV0", { v0: title });

  const act = (run: () => void) => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
    run();
  };

  return (
    <div className="history-item__menu-wrap" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className="history-item__more"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreIcon />
      </button>
      {open && (
        <div ref={menu} className="history-item__menu" role="menu" aria-label={label}>
          <button ref={firstItem} type="button" role="menuitem" onClick={() => act(onRename)}>
            {t("rename")}
          </button>
          <button type="button" role="menuitem" onClick={() => act(onDelete)}>
            {t("delete")}
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
  page,
  tripsView = "trips",
  chatsOpen,
  chatCount,
  tripCount,
  onChats,
  onTrips,
  onCalendar,
  onNewChat,
  onTrajectory,
  trajectoryOpen = false,
  chatsButton,
  onSettings,
  saveState,
  syncStatus = "local",
  children,
}: {
  collapsed?: boolean;

  collapsible?: boolean;
  onToggleCollapsed?(): void;
  page: WorkspacePage;
  tripsView?: "trips" | "calendar";
  chatsOpen: boolean;
  chatCount: number;
  tripCount: number;

  onChats?(): void;

  onTrips(): void;
  onCalendar(): void;
  onNewChat(): void;
  onTrajectory?(): void;
  trajectoryOpen?: boolean;

  chatsButton?: Ref<HTMLButtonElement>;

  onSettings(section?: SettingsSection): void;
  saveState: "saving" | "saved" | "failed";

  syncStatus?: SyncStatus;
  children?: ReactNode;
}) {
  const isCollapsed = collapsible && collapsed;
  const { t } = useLocale();

  return (
    <aside
      className={`workspace-sidebar${isCollapsed ? " is-collapsed" : ""}`}
      aria-label={t("chatsAndTrips")}
    >
      <div className="sidebar-head">
        <BrandMark showName={!isCollapsed} />
        {collapsible && (
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={t(isCollapsed ? "expandSidebar" : "collapseSidebar")}
            aria-expanded={!isCollapsed}
            data-tooltip={isCollapsed ? t("expandSidebar") : undefined}
            onClick={onToggleCollapsed}
          >
            <SidebarIcon />
          </button>
        )}
      </div>

      <nav className="sidebar-nav" aria-label={t("workspace")}>
        <NavButton
          icon={<ComposeIcon />}
          label={t("newChat")}
          collapsed={isCollapsed}
          onClick={onNewChat}
        />
        {onChats && (
          <NavButton
            buttonRef={chatsButton}
            icon={<ChatIcon filled={chatsOpen} />}
            label={t("chats")}
            collapsed={isCollapsed}
            count={chatCount}
            current={chatsOpen}
            expanded={chatsOpen}
            controls="chats-panel"
            onClick={onChats}
          />
        )}
        <NavButton
          icon={<SuitcaseIcon filled={page === "trips" && tripsView === "trips" && !chatsOpen} />}
          label={t("trips")}
          collapsed={isCollapsed}
          count={tripCount}
          current={page === "trips" && tripsView === "trips" && !chatsOpen}
          onClick={onTrips}
        />
        <NavButton
          icon={<CalendarIcon />}
          label={t("calendar")}
          collapsed={isCollapsed}
          current={page === "trips" && tripsView === "calendar" && !chatsOpen}
          onClick={onCalendar}
        />
        {onTrajectory && (
          <NavButton
            icon={<LedgerIcon />}
            label={t("trajectory")}
            collapsed={isCollapsed}
            current={trajectoryOpen}
            onClick={onTrajectory}
          />
        )}
      </nav>

      {children}

      <div className="sidebar-footer">
        {!isCollapsed && (
          <span
            className={`save-state save-state--${syncStatus === "local" ? saveState : syncStatus}`}
            role="status"
          >
            {saveState === "failed"
              ? t("saveFailed")
              : syncStatus === "syncing" || saveState === "saving"
                ? t("saving")
                : syncStatus === "synced"
                  ? t("syncedToYourAccount")
                  : syncStatus === "offline"
                    ? t("savedHereSyncPaused")
                    : t("savedLocally")}
          </span>
        )}
        <div className="sidebar-footer__actions">
          <AccountButton collapsed={isCollapsed} onSettings={onSettings} />
        </div>
      </div>
    </aside>
  );
}
