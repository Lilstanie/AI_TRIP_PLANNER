---
date: 2026-10-30
author: Claude Code
branch: feature/TP-171-reply-day-cards
pr: none
area: apps/web, docs
contract-impact: none
---

# Planning replies end with day cards

## What changed

- `components/chat/PlanDays.tsx` (new): one card per trip day with the date and up to two stop
  names, or Free day; a card calls `onOpenDay`.
- `components/chat/MessageItem.tsx`, `ChatPanel.tsx`: the cards render under the latest planned
  reply only.
- `components/workspace/WorkspaceView.tsx`: `onOpenDay` focuses the day and opens the trip (Trip view
  on a phone).
- `app/styles/messages.css`, `forms.css`: card styles, staggered entrance off under reduced motion;
  `--line` and `--surface-1` (undefined tokens) replaced, which also restores the phone Open trip
  button border.
- `lib/i18n/workspace-messages.ts`, `tests/e2e/reply-day-cards.*`, `docs/workspace-ui*.md`.

## Why

A planning reply was one paragraph with no way to reach a day from the chat. Mindtrip ends a plan
reply with cards that open the itinerary; our mock stops repeat one place, so cards are per day.

## Validation

- `reply-day-cards.e2e.mjs` against dev (mock data): before 7/12, after 15/15 (desktop, phone,
  Chinese, reduced motion, question-only reply).
- `pnpm --filter @trip/web typecheck` and `lint`, `check-ui-copy`, `verify:e2e-selectors`,
  `verify:e2e-artifacts`.

## Limitations

- `trip.css` still uses the undefined `--line` token for one border; left for the trip UI owner.
