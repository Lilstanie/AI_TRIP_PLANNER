---
date: 2026-10-31
author: Claude Code (for Joey)
branch: fix/TP-220-plan-notes-wording
pr: pending
area: packages/agents
contract-impact: none
---

# Plan notes drop internal revision wording (TP-220)

## What changed

- The itinerary, accommodation and dining agents no longer add "Revision requested: …" to their
  plan notes, and the itinerary drops "The orchestrator must recheck the full plan budget…". The
  revision still reaches each specialist's model input.
- The transport model's flight evidence now carries each candidate's departure and arrival times
  and flight time.

## Why

The live Sydney–Tokyo recheck showed both internal lines after a revision, listing the previous
round's conflicts, and a transport note saying "Departure time is not set by the evidence" for a
fare that has times: the model was never shown them.

## Validation

- `packages/agents`: `tsc --noEmit`, eslint and vitest (24 files, 207 tests) pass. The dining
  revision test no longer asserts the removed note; its price assertions remain.

## Docs

- `docs/architecture(.zh).md` itinerary paragraph.
