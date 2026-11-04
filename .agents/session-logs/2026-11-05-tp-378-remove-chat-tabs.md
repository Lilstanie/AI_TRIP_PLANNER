---
date: 2026-11-05
author: Claude Code
branch: fix/TP-378-remove-chat-tabs
pr: 974
area: apps/web
contract-impact: none
---

# Remove the dead Conversation/Trajectory chat tabs (TP-378)

## What changed

- Deleted `apps/web/components/chat/ChatViewTabs.tsx` and the `showTabs` prop of `ChatPanel`; the
  stream and Trajectory panes are always labelled regions.
- Removed `.chat__tabs`, `.chat__tab` and `.topbar-chat-tabs` rules and the unused `chatView` message.
- Kept the facts of the Trajectory tab note current: the sidebar entry opens Trajectory.

## Why

The workspace passed `showTabs={false}` since chat header navigation; only `/debug/question` still
rendered the removed tabs. `ChatView` now comes from `lib/workspace/layout`, its owner.

## Validation

- `/debug/question` at 1440: `main` shows tabs `["Conversation","Trajectory"]`, the branch shows none
  (`output/tp-378/before.png`, `after.png`).
- `npx tsc --noEmit -p apps/web` clean; `pnpm --filter @trip/web lint` warnings only, as on `main`;
  `vitest run tests/components/chat` 80 passed.

## Notes for the next person

No machine check: tsc and lint cannot see a component that is exported but never rendered with
its props enabled. Bare `eslint` reports `onEdit` and `useMemo` unused on `main`; `next lint` does not.
