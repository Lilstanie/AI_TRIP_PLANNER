"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "../account/LocaleProvider";
import {
  ChatIcon,
  ChevronIcon,
  CloseIcon,
  PencilIcon,
  PlusIcon,
  RouteIcon,
  SuitcaseIcon,
  TrashIcon,
} from "../ui/icons";

export type ChatHeaderMenuProps = {
  title: string;
  tripTitle?: string;
  siblings: { id: string; title: string }[];
  trips: { id: string; title: string; disabled?: boolean }[];
  busy?: boolean;
  trajectory?: boolean;
  onConversation(): void;
  onViewTrip?: () => void;
  onSelectChat(id: string): void;
  onNewChat(): void;
  onMoveChat(tripId: string | undefined): void;
  onNewTrip(): void;
  onRename(): void;
  onDelete(): void;
};

type Page = "root" | "chats" | "trips";

export function ChatHeaderMenu({
  title,
  tripTitle,
  siblings,
  trips,
  busy = false,
  trajectory = false,
  onConversation,
  onViewTrip,
  onSelectChat,
  onNewChat,
  onMoveChat,
  onNewTrip,
  onRename,
  onDelete,
}: ChatHeaderMenuProps) {
  const { t } = useLocale();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const submenu = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState(false);
  const focusRequest = useRef(false);
  const returningFocus = useRef(false);
  const pendingFocus = useRef<string | "last">("");
  const [page, setPage] = useState<Page | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, height: 0 });
  const [sidePosition, setSidePosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const linked = tripTitle !== undefined;

  const close = (restore = false) => {
    setPage(null);
    if (restore) trigger.current?.focus();
  };
  const act = (callback: () => void) => {
    close(true);
    callback();
  };
  const navigate = (next: Page, focus = "") => {
    if (next === page) {
      const menu = !phone && next !== "root" ? submenu.current : root.current;
      const items = menu?.querySelectorAll<HTMLButtonElement>(
        'button[role="menuitem"]:not(:disabled)',
      );
      (focus === "last" ? items?.[items.length - 1] : items?.[0])?.focus();
      return;
    }
    focusRequest.current = true;
    pendingFocus.current = focus;
    setPage(next);
  };

  useLayoutEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 520px)");
    const update = () => setPhone(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (!page) return;
    const place = () => {
      const anchor = trigger.current?.closest(".chat-header__identity")?.getBoundingClientRect();
      const menu = root.current;
      if (!anchor || !menu) return;
      const gutter = 12;
      const top = Math.max(
        gutter,
        Math.min(anchor.bottom + 8, window.innerHeight - menu.offsetHeight - gutter),
      );
      const left = Math.max(
        gutter,
        Math.min(anchor.left, window.innerWidth - menu.offsetWidth - gutter),
      );
      setPosition({ top, left, height: Math.max(0, window.innerHeight - top - gutter) });
      if (!phone && page !== "root") {
        const row = menu.querySelector<HTMLButtonElement>(`[data-page="${page}"]`);
        const sub = submenu.current;
        if (!row || !sub) return;
        const rightSpace = window.innerWidth - left - menu.offsetWidth - gutter - 8;
        const leftSpace = left - gutter - 8;
        const toLeft = rightSpace < 280 && leftSpace > rightSpace;
        const width = Math.min(320, Math.max(0, toLeft ? leftSpace : rightSpace));
        const subTop = Math.max(
          gutter,
          Math.min(row.getBoundingClientRect().top, window.innerHeight - sub.offsetHeight - gutter),
        );
        setSidePosition({
          top: subTop,
          left: toLeft ? left - width - 8 : left + menu.offsetWidth + 8,
          width,
          height: Math.max(0, window.innerHeight - subTop - gutter),
        });
      }
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [page, phone, siblings.length, trips.length]);

  useLayoutEffect(() => {
    if (!page || !focusRequest.current) return;
    const menu = !phone && page !== "root" ? submenu.current : root.current;
    const items = menu?.querySelectorAll<HTMLButtonElement>(
      'button[role="menuitem"]:not(:disabled)',
    );
    const target = pendingFocus.current;
    const restored =
      target && target !== "last"
        ? menu?.querySelector<HTMLButtonElement>(`[data-page="${target}"]`)
        : undefined;
    focusRequest.current = false;
    pendingFocus.current = "";
    returningFocus.current = Boolean(restored);
    (restored ?? (target === "last" ? items?.[items.length - 1] : items?.[0]))?.focus();
    returningFocus.current = false;
  }, [page, phone]);

  useEffect(() => {
    if (!page) return;
    const outside = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !panel.current?.contains(target) &&
        !trigger.current?.contains(target)
      ) {
        setPage(null);
        if (event.type === "pointerdown") trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [page]);

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || (event.key === "ArrowLeft" && page !== "root")) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") close(true);
      else navigate("root", page ?? "");
      return;
    }
    if (event.key === "Tab") {
      close(true);
      return;
    }
    if (event.key === "ArrowRight") {
      const next = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-page]");
      if (next && !next.disabled) {
        event.preventDefault();
        navigate(next.dataset.page as Page);
      }
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [
      ...((event.target as HTMLElement)
        .closest('[role="menu"]')
        ?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? []),
    ];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[index]?.focus();
  };

  const branch = (next: "chats" | "trips") => ({
    "data-page": next,
    "aria-haspopup": "menu" as const,
    "aria-expanded": page === next,
    "aria-controls": page === next ? `${id}-${next}` : undefined,
    onFocus: () => {
      if (!phone && !returningFocus.current && !(next === "trips" && busy)) setPage(next);
    },
    onPointerEnter: () => {
      if (!phone && !returningFocus.current && !(next === "trips" && busy)) setPage(next);
    },
    onClick: () => navigate(next),
  });
  const rootRows = (
    <>
      {onViewTrip && (
        <button type="button" role="menuitem" onClick={() => act(onViewTrip)}>
          <SuitcaseIcon />
          <span>{t("viewTrip")}</span>
        </button>
      )}
      {trajectory && (
        <button type="button" role="menuitem" onClick={() => act(onConversation)}>
          <ChatIcon />
          <span>{t("returnToChat")}</span>
        </button>
      )}
      <button type="button" role="menuitem" {...branch("chats")}>
        <ChatIcon />
        <span>{t("switchChat")}</span>
        <span className="chat-header-menu__count">{siblings.length}</span>
        <ChevronIcon />
      </button>
      <button type="button" role="menuitem" disabled={busy} {...branch("trips")}>
        <RouteIcon />
        <span>{t("moveToAnotherTrip")}</span>
        <ChevronIcon />
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        onClick={() => act(() => onMoveChat(undefined))}
      >
        <CloseIcon />
        <span>{t("removeFromTrip")}</span>
      </button>
      <div role="separator" className="chat-header-menu__separator" />
      <button type="button" role="menuitem" onClick={() => act(onRename)}>
        <PencilIcon />
        <span>{t("renameChat")}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="chat-header-menu__delete"
        onClick={() => act(onDelete)}
      >
        <TrashIcon />
        <span>{t("deleteChat")}</span>
      </button>
    </>
  );
  const subRows = (
    <>
      {phone && (
        <>
          <button type="button" role="menuitem" onClick={() => navigate("root", page ?? "")}>
            <span className="chat-header__back">
              <ChevronIcon />
            </span>
            <span>{page === "chats" ? t("switchChat") : t("moveToAnotherTrip")}</span>
          </button>
          <div role="separator" className="chat-header-menu__separator" />
        </>
      )}
      <button
        type="button"
        role="menuitem"
        disabled={page === "trips" && busy}
        onClick={() => act(page === "chats" ? onNewChat : onNewTrip)}
      >
        <PlusIcon />
        <span>{page === "chats" ? t("newChat") : t("newTrip")}</span>
      </button>
      {(page === "chats" ? siblings : trips).map((item) => {
        const disabled =
          page === "trips" && (busy || ("disabled" in item && item.disabled === true));
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={disabled}
            data-disabled={disabled || undefined}
            onClick={() =>
              act(() => (page === "chats" ? onSelectChat(item.id) : onMoveChat(item.id)))
            }
          >
            {page === "chats" ? <ChatIcon /> : <SuitcaseIcon />}
            <span>{item.title}</span>
          </button>
        );
      })}
    </>
  );

  if (!siblings.length || !linked)
    return (
      <div className="chat-header">
        {linked && onViewTrip && (
          <button
            type="button"
            className="chat-header__trip"
            aria-label={t("viewTrip")}
            onClick={onViewTrip}
          >
            <span className="chat-header__back">
              <ChevronIcon />
            </span>
          </button>
        )}
        <div className="chat-header__identity">
          <h1 className="chat-header__heading">
            <span className="chat-header__plain">{title}</span>
          </h1>
          {linked && <p className="chat-header__trip-name">{tripTitle}</p>}
        </div>
      </div>
    );

  return (
    <div className="chat-header">
      {onViewTrip && (
        <button
          type="button"
          className="chat-header__trip"
          aria-label={t("viewTrip")}
          onClick={onViewTrip}
        >
          <span className="chat-header__back">
            <ChevronIcon />
          </span>
        </button>
      )}
      <div className="chat-header__identity">
        <h1 className="chat-header__heading">
          <button
            ref={trigger}
            type="button"
            className="chat-header__title"
            aria-haspopup="menu"
            aria-expanded={page !== null}
            aria-controls={page ? id : undefined}
            onClick={() => (page ? close() : navigate("root"))}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                navigate("root", event.key === "ArrowUp" ? "last" : "");
              } else if (event.key === "Escape" && page) {
                event.preventDefault();
                event.stopPropagation();
                close(true);
              }
            }}
          >
            <span className="chat-header__name">{title}</span>
            <span className="chat-header__down">
              <ChevronIcon />
            </span>
          </button>
        </h1>
        <p className="chat-header__trip-name">{tripTitle}</p>
      </div>
      {page &&
        createPortal(
          <div ref={panel} onKeyDown={keys}>
            <div
              ref={root}
              id={id}
              role="menu"
              aria-label={
                phone && page !== "root"
                  ? page === "chats"
                    ? t("switchChat")
                    : t("moveToAnotherTrip")
                  : title
              }
              className="chat-header-menu"
              onFocus={(event) => {
                if (!phone && !(event.target as HTMLElement).closest("[data-page]"))
                  setPage("root");
              }}
              onPointerOver={(event) => {
                if (
                  !phone &&
                  (event.target as HTMLElement).closest('button[role="menuitem"]:not([data-page])')
                )
                  setPage("root");
              }}
              style={{
                top: position.top,
                left: position.left,
                maxHeight: position.height || undefined,
              }}
            >
              {phone && page !== "root" ? subRows : rootRows}
            </div>
            {!phone && page !== "root" && (
              <div
                ref={submenu}
                id={`${id}-${page}`}
                role="menu"
                aria-label={page === "chats" ? t("switchChat") : t("moveToAnotherTrip")}
                className="chat-header-menu chat-header-menu--submenu"
                style={{
                  top: sidePosition.top,
                  left: sidePosition.left,
                  width: sidePosition.width || undefined,
                  maxHeight: sidePosition.height || undefined,
                }}
              >
                {subRows}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
