---
date: 2026-10-28
author: Claude
branch: feature/TP-130-quiet-itinerary-panel
pr: 771
area: apps/web, packages/agents, docs
contract-impact: none
---

# Quiet itinerary panel (spec #755)

## What changed

- Tickets #756-#764 (TP-130..138) merged on the integration branch: Ask AI in the stop and day menus, quiet stop rows, the "N ideas" chip without the Show distances switch, the one-line budget, panel order with short Travel tips, no sidebar Chats plus, the Trajectory restyle and the Trajectory switch fix, and a final walkthrough.
- Code review round: entry tip keeps a verify clause, tablet drawer has no dead Chats button, saved tips skip the scope sentence, abbreviation-safe first sentence, one attraction requested.
- `docs/e2e-known-failures.md` lists fifteen more scripts found failing on the base.

## Validation

The walkthrough `quiet-walkthrough` leaves `result.json` and screenshots under `output/playwright/quiet-walkthrough/after/`. Each ticket has its own session log with the commands it ran.
