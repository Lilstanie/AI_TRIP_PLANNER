"use client";
import type { ReactNode } from "react";
import { useLocale } from "@/components/account/LocaleProvider";
import { ChevronIcon } from "../ui/icons";
import { HistoryMenu } from "./WorkspaceSidebar";

export function TripHome({
  title,
  tags,
  onBack,
  onRename,
  onDelete,
  children,
  actions,
  map,
  composer,
  phone,
}: {
  title: string;
  tags: readonly string[];
  onBack(): void;
  onRename(): void;
  onDelete(): void;
  children?: ReactNode;
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
        {tags.length > 0 && (
          <ul className="trip-home__tags" aria-label={t("Trip details")}>
            {tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
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
