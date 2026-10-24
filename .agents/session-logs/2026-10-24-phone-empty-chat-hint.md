---
date: 2026-10-24
author: Claude (project thread for Joey)
branch: fix/phone-empty-chat-hint
pr: none
area: apps/web
contract-impact: none
---

# Phone empty chat hint points at Add trip details

## What changed

- `apps/web/components/chat/ChatPanel.tsx`: new `phone` prop. On a phone with the Add trip details
  button the hint reads "…or tap Add trip details below."; otherwise it keeps "…in the bar at the top."
- `apps/web/components/workspace/WorkspaceView.tsx` passes `phone`; `apps/web/lib/i18n/locale.ts`
  adds the Chinese text.
- New E2E `phone-empty-chat-hint` and its failure inventory; `docs/workspace-ui` (en and zh).

## Why

#640: the fact chips are hidden at 520 px and below, so the hint pointed at nothing.

## Validation

- `node scripts/redgreen.mjs phone-empty-chat-hint -- <ChatPanel, locale, WorkspaceView>`: before
  8/16 ok (all phone checks failed), after 16/16 ok at 375, 520 and 1440 px in English and Chinese.
- `pnpm --filter @trip/web typecheck`, `lint`, `test` (642 passed), `check-ui-copy`: pass.
