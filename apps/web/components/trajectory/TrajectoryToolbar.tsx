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
  hitCount: number | null;
  hitPosition: number;
  onStepHit: (delta: 1 | -1) => void;
  t: TrajectoryTranslate;
}

export function TrajectoryToolbar({
  allTurnsCollapsed,
  onToggleAllTurns,
  allAssistantsCollapsed,
  onToggleAllAssistants,
  searchQuery,
  onSearchQueryChange,
  hitCount,
  hitPosition,
  onStepHit,
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
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              onStepHit(event.shiftKey ? -1 : 1);
            }}
          />
        </div>
        {hitCount !== null && (
          <div className={css.hits} role="group" aria-label={t("toolbar.hits")}>
            <span className={css.hitCount} role="status" data-search-count={hitCount}>
              {hitCount === 0 ? 0 : hitPosition + 1}/{hitCount}
            </span>
            <button
              type="button"
              className={css.hitStep}
              aria-label={t("toolbar.prevHit")}
              title={t("toolbar.prevHit")}
              disabled={hitCount === 0}
              onClick={() => {
                onStepHit(-1);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className={css.hitStep}
              aria-label={t("toolbar.nextHit")}
              title={t("toolbar.nextHit")}
              disabled={hitCount === 0}
              onClick={() => {
                onStepHit(1);
              }}
            >
              ↓
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
