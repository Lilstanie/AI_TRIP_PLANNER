---
date: 2026-10-25
author: Composer (Cursor)
branch: feature/TP-91-progressive-empty-workspace
pr: none
area: apps/web, docs, GLOSSARY
contract-impact: none
---

# Progressive empty workspace chrome (TP-91–TP-96)

## What changed

- Removed the centre empty card; suggestion chips sit beside the composer on blank untouched chats.
- Brief bar and Preferences appear only after typing, draft≠Travel profile, or messages exist.
- Desktop top-left: Conversation | Trajectory + Agent Team; Trip only with a Plan; language shortcuts removed.
- Rotating composer placeholders; E2E `progressive-empty-workspace`; glossary + workspace-ui docs.

## Why

Grilled consensus on #706 / TP-91–TP-96: progressive disclosure of intake chrome.

## Validation

- `pnpm --filter @trip/web exec tsc --noEmit` — pass
- `vitest run ChatPanel.test.tsx Workspace.test.tsx` — pass

## Notes for the next person

Run `progressive-empty-workspace` E2E against a live web server before merge; update Jira stories to Done after merge.
