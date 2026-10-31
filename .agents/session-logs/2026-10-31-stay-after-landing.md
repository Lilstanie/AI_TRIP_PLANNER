---
date: 2026-10-31
author: Claude Code
branch: fix/TP-210-stay-after-landing
pr: none
area: packages/agents
contract-impact: none
---

# The first stay starts on the landing date

## What changed

- `packages/agents/src/accommodation/planning.ts`: `splitStay` takes the outbound arrival day and
  moves the first city's check-in to it, dropping the nights before landing.
- `packages/agents/src/accommodation/index.ts` passes `outboundArrival(brief, board.proposals)`;
  accommodation already waits for transport on the planning board.
- `docs/architecture(.zh).md`.

## Why

In the live Tokyo check the flight left Sydney on 10 Dec, stopped overnight in Kansai and reached
Narita at 08:50 on 11 Dec, but the Tokyo hotel was booked from 10 Dec, so one paid night was unused.

## Validation

- `packages/agents` vitest 207 and `packages/orchestrator` vitest 422 passed; no new tests (Joey
  asked for as few as possible). Live check on the Mac follows the merge.

## Limitations

- A return flight without a time still does not limit the last day's stops.
