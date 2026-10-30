---
date: 2026-10-30
author: Claude Code
branch: feature/ui-motion-polish
pr: none
area: apps/web, packages/orchestrator, docs
contract-impact: none
---

# Restored trips stay editable; blank chat composer starts centred

## What changed

- `apps/web/lib/trip/tab-revision.ts`: the tab fingerprint sorts object keys and parses the stored
  value, so a plan reloaded through the schema (different key order) matches its own revision.
- `packages/orchestrator/src/chat.ts`: the no-model fallback reply ends each section summary with a
  full stop before joining.
- `apps/web/components/chat/ChatPanel.tsx`, `app/styles/chat.css`: desktop/tablet blank chat keeps the
  composer near the centre and glides it to the bottom on first send (WAAPI, skipped under reduced motion).
- `apps/web/tests/e2e/chat-start-and-restore.e2e.mjs`, `docs/workspace-ui*.md`.

## Why

After any reload, every itinerary edit on a saved trip failed with "This edit is stale" and the
sidebar stuck on "Saving…": `JSON.stringify` fingerprints differed only by `editVersion` key order.

## Validation

- `chat-start-and-restore.e2e.mjs` against `pnpm --filter @trip/web dev` (mock data): before 4/11,
  after 11/11.
- `pnpm --filter @trip/orchestrator test`: 413 passed.

## Notes for the next person

`useWorkspaceStorage` still leaves "Saving…" when a genuinely newer plan exists in another tab; left
alone because PR #782 rewrites that file.
