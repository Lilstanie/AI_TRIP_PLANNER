---
date: 2026-09-24
author: Claude Code (Opus 5.5, with a subagent)
branch: feature/sidebar-refresh
pr: none
area: apps/web, docs
contract-impact: none
---

# Refresh the sidebar: line nav icons, primary New chat, one search field, title-only chats

## What changed

- `icons.tsx`: `ChatIcon`, `SuitcaseIcon` and `BookmarkIcon` take `filled`. The sidebar nav drops
  the coloured icon tiles for plain line icons in the text colour, and the current section fills
  its icon in (Mindtrip's pattern) with a quiet background instead of a border and leading bar.
  Selected history rows use the same quiet background. The logo is unchanged: a vector logo was
  tried and reverted at the owner's request.
- `WorkspaceSidebar.tsx`: New chat is a full-width accent button (accent icon button when
  collapsed); search is one field with the magnifier inside, a "Search" placeholder and a Clear
  search button; history rows render the title only for chats (trips keep dates, total and status)
  and no timestamp. `useWorkspaceController.ts` stops building `subtitle`/`updatedAt` for chats.
- `workspace-navigation.css`: sidebar spacing moved onto `--space-*` tokens, shared leading edges,
  single-line rows with hover fill, the overflow trigger centred without a transform, a sentence-case
  section label, and a footer that wraps at 200 px instead of truncating "Saved locally".
- Tests: `Workspace.test.tsx` adds the filled current-section icon, title-only rows and search
  clearing, and a `newChatButton()` helper because an untitled chat's
  row is now also named "New chat". `docs/workspace-ui.md` Sidebar section updated.

## Why

A chat's row name is now just its title, so the default "New chat" title matches the primary
action's name; the row stays inside the "Chats" region, so the helper picks the first match.

## Validation

- `pnpm --filter @trip/web test`: 32 files, 307 tests passed.
- `cd apps/web && npx tsc --noEmit`: no errors. `pnpm --filter @trip/web lint`: no warnings.
- `npx prettier --check` on the changed TS, CSS and Markdown files: clean. `pnpm verify:docs` and
  `pnpm verify:protected`: pass.
- Browser (dev server, mock and live toggle untouched, no messages sent): 1440×1000 light and dark,
  expanded, collapsed (tooltips, search expands and focuses), resized to 200 px (shared edges,
  placeholder fits, footer wraps), Tab order and focus ring, search filter and clear, overflow menu
  open/Escape focus return; 390×844 light and dark nav drawer, menu Escape keeps the drawer open,
  `scrollWidth === innerWidth` (390). Sample chats were injected into localStorage and removed.

- Parent session, after the nav icon change: reviewed with the better-ui skill (restored the 1px
  transparent nav border the search icon aligns to) and the better-accessibility skill (names,
  `aria-current`, visible focus ring on Tab). Checks were chosen by pre-push-checks:
  `pnpm --filter @trip/web test tests/components/workspace` passed (3 files, 40 tests), and
  typecheck, lint, prettier, `verify:docs` and `verify:protected` passed. Both commits were checked
  on their own.

## Notes for the next person

The nav icon change was checked by the parent session at 1060 × 600, light and dark, with
Trips selected and then Chats.

Trip rows (with a real saved trip) were not viewed in the browser; they are covered by existing
tests only. No keyboard shortcut for New chat was added.
