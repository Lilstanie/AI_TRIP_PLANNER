/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

"use client";
import { IconSearchOutlineRegular } from "./shim";
import type { TrajectoryTranslate } from "./locales";
import css from "./TrajectoryToolbar.module.css";

export interface TrajectoryToolbarProps {
  allTurnsCollapsed: boolean;
  onToggleAllTurns: () => void;
  allAssistantsCollapsed: boolean;
  onToggleAllAssistants: () => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  t: TrajectoryTranslate;
}

export function TrajectoryToolbar({
  allTurnsCollapsed,
  onToggleAllTurns,
  allAssistantsCollapsed,
  onToggleAllAssistants,
  searchQuery,
  onSearchQueryChange,
  t,
}: TrajectoryToolbarProps) {
  return (
    <div className={css.root} role="toolbar" aria-label={t("toolbar.aria")}>
      <div className={css.inner}>
        <div className={css.actions}>
          <button
            type="button"
            className={css.action}
            aria-label={allTurnsCollapsed ? t("toolbar.expandTurns") : t("toolbar.collapseTurns")}
            aria-pressed={allTurnsCollapsed}
            title={allTurnsCollapsed ? t("toolbar.expandTurns") : t("toolbar.collapseTurns")}
            onClick={onToggleAllTurns}
          >
            <span className={css.actionIcon} aria-hidden="true">
              {allTurnsCollapsed ? "⊞" : "⊟"}
            </span>
            {t("toolbar.turns")}
          </button>
          <button
            type="button"
            className={css.action}
            aria-label={
              allAssistantsCollapsed ? t("toolbar.expandCalls") : t("toolbar.collapseCalls")
            }
            aria-pressed={allAssistantsCollapsed}
            title={allAssistantsCollapsed ? t("toolbar.expandCalls") : t("toolbar.collapseCalls")}
            onClick={onToggleAllAssistants}
          >
            <span className={css.actionIcon} aria-hidden="true">
              {allAssistantsCollapsed ? "⊞" : "⊟"}
            </span>
            {t("toolbar.calls")}
          </button>
        </div>
        <div className={css.search}>
          <IconSearchOutlineRegular size={11} className={css.searchIcon} />
          <input
            type="search"
            className={css.searchInput}
            aria-label={t("toolbar.search")}
            placeholder={t("toolbar.searchPlaceholder")}
            value={searchQuery}
            onChange={(event) => {
              onSearchQueryChange(event.currentTarget.value);
            }}
          />
        </div>
      </div>
    </div>
  );
}
