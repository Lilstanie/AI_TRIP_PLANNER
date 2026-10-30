---
date: 2026-10-30
author: Claude Code
branch: feature/TP-181-offline-follow-up
pr: none
area: packages/orchestrator, apps/web tests, docs
contract-impact: none
---

# Offline follow-ups no longer rerun the whole plan

## What changed

- `packages/orchestrator/src/chat.ts`: `runOffline` returns the current plan unchanged, with a reply
  that says chat can only change the destination, dates, travellers or budget, when the brief after
  the offline intake equals the plan's brief.
- `packages/orchestrator/src/chat-offline.ts`: `statedTripDays` ignores ordinals such as 第三天, which
  had turned "第三天加一个法朵表演" into a three-day trip.
- `packages/orchestrator/src/chat-grounding.ts`: the unchanged-plan reply follows the message
  language.
- `packages/orchestrator/tests/offline-follow-up.failures.md`, `tests/chat.test.ts`,
  `apps/web/tests/e2e/offline-follow-up.e2e.mjs`, `docs/api*.md`.

## Why

In mock data (no model) every follow-up such as "What's the weather like?" reran all five specialists
and answered "I rechecked the itinerary, but no changes were applied", in the interface language.

## Validation

- `offline-follow-up.e2e.mjs` against dev (mock data), English and Chinese.
- `pnpm --filter @trip/orchestrator exec vitest run`.
