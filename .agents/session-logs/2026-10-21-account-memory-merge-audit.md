---
date: 2026-10-21
author: Codex
branch: feature/account-memory-integration
pr: none
area: apps/web, packages/agents, packages/orchestrator, scripts
contract-impact: api
---

# Integrate and verify account memory

## What changed

- Integrated `origin/main` through `0b88fb3` after PRs 447, 448, 451 and 470.
- Account-memory undo now reports success only when its account/key/token-guarded write affects a row; deterministic E2E races cover restore and first-write delete.
- Profile precedence recognizes Chinese dietary descriptions and avoids matching `art` inside unrelated words; production-boundary E2E covers both.
- Added the two approved protected-route classifications for account memory and undo.

## Validation

- `pnpm --filter @trip/web e2e accommodation-memory` — passed; deterministic restore/delete races and account memory route flow. Runner: `2026-10-21T04-40-54-788Z.json`.
- `pnpm --filter @trip/web e2e long-term-memory` — passed; English apartment and Chinese dietary profile precedence. Runner: `2026-10-21T04-41-16-853Z.json`.
- `pnpm --filter @trip/web e2e memory-settings` — passed; EN/ZH desktop/phone. Runner: `2026-10-21T04-41-56-589Z.json`.
- `pnpm --filter @trip/web e2e settings-memory-hidden` — 16/16 passed. Runner: `2026-10-21T04-42-20-432Z.json`.
- Web tests 645/645; agents 138/138; orchestrator 280/280; script tests 40/40. Web build, lint and typecheck; agents and orchestrator typecheck — passed.
- Protected files, docs, translation pairs (27), E2E selectors and artifact checks; `git diff --check` — passed.

## Notes for the next person

- Browser E2E uses local PGlite and fixture identity; it does not establish deployed Clerk/Neon, live-model, or provider behavior. No external database migration was applied.
- The production build and lint report the existing multiple-lockfile workspace-root warning; both commands passed.
- The original PR 455 was closed unmerged at the owner's request. This work needs a new PR. New-head CI and retro are pending push.
