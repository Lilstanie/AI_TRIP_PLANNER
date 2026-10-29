---
date: 2026-10-29
author: Codex
branch: fix/TP-27-city-flight-pricing
pr: none
area: packages/agents, packages/orchestrator, docs
contract-impact: none
---

# Price every planned flight leg

## What changed

- Search all planned flight legs and retain journey order in transport evidence.
- Add a planning workflow regression and update the architecture documentation pair.

## Why

A traveller-selected city flight was omitted when an arrival flight appeared first.

## Validation

- The workflow test failed before the fix: only Sydney to Tokyo was searched.
- `vitest run packages/agents/tests packages/orchestrator/tests`: 599 tests passed.
- Agents and orchestrator TypeScript checks and changed-file ESLint passed.
- Documentation, translation pairs, protected files, E2E selectors and artifacts checks passed.

## Notes for the next person

The workflow test uses fixture flight fares; it does not exercise live providers or a browser.
