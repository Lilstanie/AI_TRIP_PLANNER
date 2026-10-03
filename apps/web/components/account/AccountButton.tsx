"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronIcon, MoreIcon, UserIcon } from "../ui/icons";
import { useAccount } from "./AccountProvider";
import type { SettingsSection } from "./SettingsDialog";
import { useLocale } from "./LocaleProvider";

/** Profile identity stays visible in the sidebar; its overflow opens account and settings actions. */
export function AccountButton({
  collapsed,
  onSettings,
}: {
  collapsed: boolean;
  onSettings(section?: SettingsSection): void;
}) {
  const account = useAccount();
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuItems = useRef<Array<HTMLButtonElement | null>>([]);
  const signedIn = account.status === "signed-in";
  const name = signedIn
    ? account.name
    : account.status === "signed-out"
      ? t("Sign in")
      : account.status === "loading"
        ? t("Account")
        : t("Local");
  const subtitle = signedIn
    ? account.username
      ? `@${account.username}`
      : "Your travel workspace"
    : account.status === "signed-out"
      ? t("Keep your trips in sync")
      : account.status === "loading"
        ? t("Checking account…")
        : t("Saved in this browser");
  const menuItemsList: Array<
    { kind: "section"; id: SettingsSection; label: string } | { kind: "sign-out"; label: string }
  > = [
    { kind: "section", id: "profile", label: t("View profile") },
    { kind: "section", id: "account", label: t("Account settings") },
    { kind: "section", id: "personalization", label: t("Personalization") },
    { kind: "section", id: "region", label: t("Language & region") },
    ...(signedIn ? [{ kind: "sign-out" as const, label: t("Sign out") }] : []),
  ];

  useEffect(() => {
    if (open) menuItems.current[focusIndex]?.focus({ preventScroll: true });
  }, [open, focusIndex]);

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
      if (event.relatedTarget && !wrap.current?.contains(event.relatedTarget as Node)) close(false);
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

  const openMenu = (index = 0) => {
    setFocusIndex(index);
    setOpen(true);
  };

  const choose = (index: number) => {
    const item = menuItemsList[index];
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
    if (item?.kind === "section") onSettings(item.id);
    if (item?.kind === "sign-out" && account.status === "signed-in") void account.signOut();
  };

  const moveMenuFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
      return;
    }
    const current = menuItems.current.findIndex((item) => item === document.activeElement);
    let next: number | undefined;
    if (event.key === "ArrowDown")
      next = (current + 1 + menuItemsList.length) % menuItemsList.length;
    if (event.key === "ArrowUp") next = (current - 1 + menuItemsList.length) % menuItemsList.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = menuItemsList.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    setFocusIndex(next);
    menuItems.current[next]?.focus({ preventScroll: true });
  };

  const avatar =
    signedIn && account.imageUrl ? (
      // Clerk hosts the avatar; it is the person's own picture, not decoration.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="account-button__avatar"
        src={account.imageUrl}
        alt=""
        width={36}
        height={36}
      />
    ) : signedIn ? (
      <span className="account-button__avatar account-button__initial" aria-hidden="true">
        {account.name.slice(0, 1).toUpperCase()}
      </span>
    ) : (
      <span className="account-button__avatar account-button__initial" aria-hidden="true">
        <UserIcon />
      </span>
    );

  return (
    <div ref={wrap} className="account-button__wrap">
      <div className="account-button__row">
        <button
          type="button"
          className="account-button__profile"
          aria-label={`${t(signedIn ? "View profile" : "Account settings")}${locale === "zh-CN" ? "：" : ": "}${name}`}
          aria-busy={account.status === "loading" || undefined}
          onClick={() => onSettings(signedIn ? "profile" : "account")}
        >
          {avatar}
          {!collapsed && (
            <span className="account-button__identity">
              <strong>{name}</strong>
              <small>{subtitle}</small>
            </span>
          )}
        </button>
        <button
          ref={trigger}
          type="button"
          className="account-button__more"
          aria-label={t("Open account menu")}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? "account-settings-menu" : undefined}
          aria-busy={account.status === "loading" || undefined}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={(event) => {
            if (open || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
            event.preventDefault();
            openMenu(event.key === "ArrowDown" ? 0 : menuItemsList.length - 1);
          }}
        >
          <MoreIcon />
        </button>
      </div>
      {open && (
        <div
          id="account-settings-menu"
          className="account-menu"
          role="menu"
          aria-label={t("Account and settings")}
          onKeyDown={moveMenuFocus}
        >
          {menuItemsList.map((item, index) => (
            <div key={item.kind === "section" ? item.id : item.kind}>
              {index === 1 || (item.kind === "sign-out" && index > 0) ? (
                <div className="account-menu__separator" role="separator" />
              ) : null}
              <button
                ref={(element) => {
                  menuItems.current[index] = element;
                }}
                type="button"
                role="menuitem"
                tabIndex={focusIndex === index ? 0 : -1}
                className={item.kind === "sign-out" ? "account-menu__sign-out" : undefined}
                onFocus={() => setFocusIndex(index)}
                onClick={() => choose(index)}
              >
                {item.kind === "section" && item.id === "profile" ? (
                  <>
                    {avatar}
                    <span className="account-menu__profile-copy">
                      <strong>{name}</strong>
                      <small>{item.label}</small>
                    </span>
                    <ChevronIcon />
                  </>
                ) : (
                  item.label
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
