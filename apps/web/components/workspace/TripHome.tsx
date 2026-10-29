"use client";
import type { ComponentProps, ReactNode } from "react";
import { TripFactChips } from "../preferences/TripFactChips";
import { LocaleProvider, useLocale } from "@/components/account/LocaleProvider";
import { ChevronIcon } from "../ui/icons";
import { HistoryMenu } from "./WorkspaceSidebar";

export function TripHome({
  title,
  facts,
  onBack,
  onRename,
  onDelete,
  children,
  suggestion,
  actions,
  map,
  composer,
  phone,
}: {
  title: string;
  facts: ComponentProps<typeof TripFactChips>;
  onBack(): void;
  onRename(): void;
  onDelete(): void;
  children?: ReactNode;
  suggestion?: ReactNode;
  actions?: ReactNode;
  map?: ReactNode;
  composer?: ReactNode;
  phone: boolean;
}) {
  const { t } = useLocale();
  return (
    <div className="trip-home" data-aside={map ? "true" : undefined}>
      <div className="trip-home__main">
        <header className="trip-home__head">
          <button
            type="button"
            className="trip-home__back"
            aria-label={t("Back to trips")}
            onClick={onBack}
          >
            <span className="trip-home__back-icon">
              <ChevronIcon />
            </span>
          </button>
          <h1 className="trip-home__title">{title}</h1>
          <div className="trip-home__menu">
            <HistoryMenu title={title} onRename={onRename} onDelete={onDelete} />
          </div>
        </header>
        <LocaleProvider brief={facts.draft}>
          <TripFactChips {...facts} facts={["where", "when", "who", "budget"]} />
        </LocaleProvider>
        {suggestion}
        {phone && actions}
        {children}
        {phone && map}
        {composer}
      </div>
      {!phone && map && (
        <aside className="trip-home__aside">
          {actions}
          {map}
        </aside>
      )}
    </div>
  );
}
