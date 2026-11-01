---
date: 2026-10-31
author: Claude Code (for Joey)
branch: fix/TP-215-pace-cap-candidates
pr: pending
area: packages/tools, packages/agents/src/itinerary
contract-impact: none
---

# Enforce the daily sight cap and keep more Geoapify candidates (TP-215)

## What changed

- Geoapify keeps up to 60 sights or neighbourhoods per category instead of 20.
- A valid itinerary draft with a day holding more sights than the pace allows (2, 3 or 6, restaurants
  excluded) goes back to the model with the travel conflicts; the draft with fewer problems is kept.

## Why

The live packed Tokyo check after PR #861 still had 13 neighbourhood stops: 20 sights per category
was below the 36 a packed six-day trip needs, so neighbourhoods were always offered. The same run
had days with 7-8 sights, above the packed cap.

## Validation

- `vitest run` in `packages/tools` and `packages/agents`.

## Limitations

- The model may still exceed the cap after two retries; the draft with fewer problems is kept.
