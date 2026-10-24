---
date: 2026-10-24
author: Claude Sonnet 5.5
branch: feature/TP-72-trajectory-tab
pr: none
area: apps/web, docs, THIRD_PARTY_NOTICES.md
contract-impact: none
---

# Trajectory tab with the DSH ledger on desktop (#668, TP-72)

## What changed

- `apps/web/components/trajectory/`: DSH ledger table, timeline, toolbar, record types, search index and
  virtual rows copied with their MIT headers; `shim.tsx` replaces the DSH imports; `locales.ts` holds en and zh.
- `apps/web/lib/trajectory/adapter.ts`: maps `Message[]` and stored `activity` to DSH turns and steps.
- `components/chat/ChatPanel.tsx`, `app/styles/chat.css`, `workspace-messages.ts`: Conversation and Trajectory tabs.
- `tests/e2e/trajectory-tab.{e2e.mjs,failures.md}`; header entries in `comment-exceptions.json`.
- Docs: `workspace-ui` en and zh, `THIRD_PARTY_NOTICES.md` (sentence corrected), new Agent Note
  `implemented/feature/2026-10-24-trajectory-tab.md`. `@tanstack/react-virtual` added to `apps/web`.

## Why

The adapter feeds DSH's turn model instead of shimming its conversation snapshot; the note records this.

## Validation

- `node scripts/redgreen.mjs --base origin/feature/TP-72-trajectory trajectory-tab -- apps/web/components/chat/ChatPanel.tsx`:
  before 0/2 ok (failed), after 94/94 ok (1440, en and zh, mock data, screenshots and `result.json`).
- `pnpm exec tsc --noEmit` in `apps/web`: clean. `eslint` on the new directories: clean.
- `verify:docs`, `verify:pairs`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `check-ui-copy`: pass.
- `check-added-comments.mjs` with the exceptions file: pass. Prettier on changed files.

## Notes for the next person

- No timestamps exist on events, so the overview is equal-width; durations would need a shared-contract change.
- Row virtualisation (above 100 records) is copied but not exercised by the E2E.
- `ChatPanel` still reports a pre-existing unused `onEdit` lint error.
