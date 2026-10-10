"use client";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { ChatIcon, MapIcon, RouteIcon, UserIcon } from "../ui/icons";
import { useLocale } from "../account/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/locale";
import { PHONE_VIEWS, type MobileView } from "./workspace-helpers";

const TABS: Record<MobileView, { label: MessageKey; icon: (selected: boolean) => ReactNode }> = {
  chat: { label: "Chat", icon: (selected) => <ChatIcon filled={selected} /> },
  map: { label: "Map", icon: () => <MapIcon /> },
  trip: { label: "Trip", icon: () => <RouteIcon /> },
  mine: { label: "Mine", icon: () => <UserIcon /> },
};

export const phonePanelId = (view: MobileView) => `phone-panel-${view}`;

type Props = {
  view: MobileView;
  onSelect(view: MobileView): void;

  badges?: Partial<Record<MobileView, ReactNode>>;

  hidden?: boolean;
};

export function PhoneTabBar({ view, onSelect, badges, hidden }: Props) {
  const { t } = useLocale();
  const tabs = useRef<Partial<Record<MobileView, HTMLButtonElement | null>>>({});
  const onKeyDown = (event: KeyboardEvent) => {
    const index = PHONE_VIEWS.indexOf(view);
    const last = PHONE_VIEWS.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    const target = PHONE_VIEWS[next];
    onSelect(target);
    tabs.current[target]?.focus();
  };
  return (
    <nav className="phone-tabbar" data-hidden={hidden || undefined} inert={hidden}>
      <div
        role="tablist"
        aria-label={t("Workspace sections")}
        className="phone-tabbar__list"
        onKeyDown={onKeyDown}
      >
        {PHONE_VIEWS.map((tab) => {
          const selected = tab === view;
          return (
            <button
              key={tab}
              ref={(node) => {
                tabs.current[tab] = node;
              }}
              type="button"
              role="tab"
              id={`phone-tab-${tab}`}
              aria-selected={selected}
              aria-label={tab === "trip" && badges?.trip ? t("Trip updated") : undefined}
              aria-controls={phonePanelId(tab)}
              tabIndex={selected ? 0 : -1}
              className="phone-tabbar__tab"
              onClick={() => !selected && onSelect(tab)}
            >
              <span className="phone-tabbar__icon">{TABS[tab].icon(selected)}</span>
              <span className="phone-tabbar__label">{t(TABS[tab].label)}</span>
              {badges?.[tab]}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
