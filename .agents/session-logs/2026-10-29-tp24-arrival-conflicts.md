---
date: 2026-10-29
author: Codex
branch: fix/TP-24-flight-time-conflicts
pr: none
area: packages/agents, packages/orchestrator, docs
contract-impact: none
---

# Detect activities before arrival flights land

## What changed

- Preserve selected flight candidate identity and expose usable same-day provider times.
- Compare itinerary activities against the selected flight's destination-local arrival.
- Add a repeatable integration reproduction and update architecture documentation and an Agent Note.

## Validation

- The arrival-flight workflow reproduction failed before the fix and passed after it.
- Focused transport and conflict regression checks passed; see PR evidence for final checks.

## Notes for the next person

- Untimed flights do not establish an arrival conflict; overnight departures do not get a fabricated item start time.
