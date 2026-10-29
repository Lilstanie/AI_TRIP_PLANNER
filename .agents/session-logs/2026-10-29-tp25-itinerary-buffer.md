---
date: 2026-10-29
author: Codex
branch: fix/TP-25-itinerary-buffer
pr: none
area: packages/agents, docs
contract-impact: none
---

# Align itinerary draft and route-check buffers

## What changed

- Instruct the itinerary model to allow route duration plus a 15-minute arrival buffer.
- Add a model-boundary regression, failure inventory, and architecture documentation pair.

## Why

Route durations are not known until the drafted activities have been routed. The old fixed
150-minute instruction did not match validation.

## Validation

- The boundary regression failed before the change on the fixed 150-minute instruction and passed after it.
- `vitest run packages/agents/tests`: 187 tests passed.
- Agents TypeScript, changed-file ESLint, documentation, translation-pair, protected-file, E2E selector and artifact checks passed.

## Notes for the next person

The test stubs the model and route provider; it does not measure model compliance or live route results.
