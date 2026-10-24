---
date: 2026-10-24
author: Claude Haiku 5.5 (scheduled triage run)
branch: fix/chat-row-menu-names
pr: none
area: apps/web
contract-impact: none
---

# Chats row ⋮ buttons carry the chat's trip subtitle in their accessible name

## What changed

- `apps/web/components/workspace/ChatsPanel.tsx`: the Chats `HistoryMenu` title now joins the chat title and its subtitle, so each ⋮ button reads "Actions for <title>, <subtitle>".
- `apps/web/tests/e2e/chat-rows-same-trip.e2e.mjs`: new check that the two same-title Sydney chats have distinct ⋮ names containing their subtitles.

## Why

Issue #659. Both ⋮ buttons were named from the title only, so the two chats were indistinguishable to assistive tech. The subtitle is already disambiguated by `distinctTripTitles` (commit 011af734), so joining it gives distinct names.

## Validation

- `pnpm --filter @trip/web e2e chat-rows-same-trip` (run as `node tests/e2e/chat-rows-same-trip.e2e.mjs`, dev server on :3000): with fix, all 5 checks ok, 0 page errors. Without the ChatsPanel change: the new check FAILs with both names "Actions for Sydney · 15–18 Nov".
- `pnpm --filter @trip/web typecheck`: exit 0.
- `pnpm --filter @trip/web lint`: exit 0, no ESLint warnings or errors.
- `pnpm exec prettier --check` on both changed files: all formatted.
- `pnpm verify:e2e-selectors`: exit 0. `pnpm verify:e2e-artifacts`: exit 0.

## Notes for the next person

- Ran in a separate git worktree because the primary checkout holds an untracked, locally modified `.agents/session-logs/2026-10-19-agent-lab-stay-evidence.md` that conflicts with origin/main.
- The title-plus-subtitle label is joined with a hardcoded ", ". Not translated; acceptable for now.
- Code review skill and the full five-check set were not run.
