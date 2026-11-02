---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-271-long-ground-hop
pr: none
area: packages/agents, docs
contract-impact: none
---

# Long inter-city ground hops are flown when a fare exists

## What changed

- `packages/agents/src/transport/index.ts`: ground hops over six hours (mode not chosen) are priced as flights; a hop with no fare stays on the ground and its flight conflicts are dropped.
- Agent Note `2026-11-02-long-ground-hops-fly.md`; `docs/architecture.md` + `.zh.md`.

## Why

Live re-run: Bangkok → Chiang Mai was a ten-hour coach filling day 6.

## Validation

- `pnpm --filter @trip/agents test` 207 passed, `@trip/orchestrator` 430 passed.

## Notes for the next person

none
