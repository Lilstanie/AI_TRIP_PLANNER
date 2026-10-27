---
date: 2026-10-27
author: Codex
branch: feature/account-memory-integration
pr: 508
area: apps/web, packages/agents, packages/orchestrator, docs
contract-impact: packages/shared
---

# Integrate account memory after the Trip and route-mode changes

## What changed

- Integrated main `1551d2bd` (#726 then #714); preserved typed revision intent and planning readiness.
- Memory list reads now return 503 on failure; planning alone falls back to an empty memory list.
- Chat request and stream cancellation reach the memory transaction; detected cancellation rolls back the write.
- Updated paired API docs and the implemented account-memory note; added browser and actual-driver evidence.
- Allowed Settings memory hints because they explain cross-plan reuse and the sign-in prerequisite, neither visible in the layout.

## Validation

- Settings failure reproduced as a false empty state; repaired production GET and retry/list/delete/toggle/sign-out passed desktop/phone in EN/ZH.
- In-flight cancellation red: 1 persisted row; green: 0 rows. An already-aborted request skips planning.
- `node apps/web/tests/e2e/chat-memory-cancellation.e2e.mjs`, `neon-memory-driver.e2e.mjs`, `memory-settings.e2e.mjs`: passed; driver 24 checks, all 20 clients closed.
- `pnpm --filter @trip/web e2e accommodation-memory long-term-memory planning-readiness`: all three passed on the integrated production changes.
- `pnpm --filter @trip/web build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`: passed; 122 files / 1,443 tests. Existing hook/canvas warnings remain.
- `pnpm test:scripts`: 70 passed, none skipped. Docs, 29 translation pairs, protected files, selectors and artifact checks passed.
- `pnpm --filter @trip/web db:generate`: schema matches the committed migration. No external database migration was run.
- Independent Luna high Spec and Standards reviews: zero remaining findings. Node 26.8.1, pnpm 9.15.0, Chrome 156.0.8078.48.

## Notes for the next person

- User explicitly approved only the two new protected API-auth checklist entries and ordered merges after verification.
- Cancellation after the final signal check can arrive too late to prevent physical commit; Settings remains the recovery path.
- Browser fixtures retain production routes and memory transactions but stub account identity and planning; driver transport is local PGlite, not live Neon.
- Red/green artifacts and logs are retained outside output cleanup directories. Current-head CI is required before merge.
