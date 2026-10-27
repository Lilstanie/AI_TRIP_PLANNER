---
date: 2026-10-27
author: Claude
branch: feature/TP-112-phone-empty-states
pr: none
area: apps/web, docs
contract-impact: none
---

# Empty phone screens say one sentence and offer one action

## What changed

- `ChatPanel` hides the estimates footer on a blank phone chat; `TripsPage` and `ChatsPanel` drop the
  switch, search field and blank Chats section from Mine with nothing saved; one short "No trips yet.".
- `TripEditor`, `TrajectoryTab` and `WorkspaceView` empty copy cut to one sentence; the phone Trip drawer
  without a plan offers only Plan in Chat. Strings paired in `workspace-messages` and `phone-messages`.
- E2E: `phone-empty-chat-hint` (failure inventory first, 390x844 and 360x800, en and zh), plus
  `trajectory-empty`, `progressive-empty-workspace` and `short-phone-empty-chat` updated.
- Docs: `docs/workspace-ui.md` and `.zh.md`; Agent Note `2026-10-27-phone-empty-states.md`.

## Why

See the Agent Note. The inventory of what repeated is in `phone-empty-chat-hint.failures.md`.

## Validation

- `phone-empty-chat-hint` before the fix: failed on every new Chat, Mine, Trajectory and empty-day check;
  after: all checks pass (`apps/web/output/playwright/phone-empty-chat-hint/{fail-first,after}/result.json`).
- `trajectory-empty`, `phone-mine`, `short-phone-empty-chat`, `progressive-empty-workspace`: pass.
- `pnpm --filter @trip/web test` 643 passed; build, typecheck, lint, verify:docs, :pairs, :protected,
  :e2e-selectors, :e2e-artifacts, check-ui-copy.mjs: pass.

## Notes for the next person

Desktop sidebar empty lines ("No trips yet. Start one with New trip.") and the Settings memory empty
lines are outside the phone rule and unchanged.
