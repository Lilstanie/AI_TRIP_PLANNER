---
date: 2026-09-27
author: Claude Code
branch: fix/ratings-and-trip-count
pr: none
area: packages/agents, packages/orchestrator, apps/web, docs
contract-impact: none
---

# Ratings out of 5; the Trip button counts stops

## What changed

- Stay ratings stay 0–10 internally and are shown out of 5: accommodation details and
  assumptions, the orchestrator's stay choice and tool rows, `ProposalDetails`, and the timeline's
  stay row (which also reads saved "/10" details).
- Place rows in the thinking transcript showed Google's 1–5 rating as "/10"; now "/5", unconverted.
- The Trip button's badge counts the trip's stops instead of unresolved conflicts (which remain as
  "Needs review" on the drawer and in Review plan).
- `progress-tools.test.ts` expects the new stay row text; docs in English and Chinese.

## Why

The owner's review (`docs/problem.md`): ratings should read out of 5, and a lone "1" beside Trip
read as nonsense.

## Validation

- Full `pnpm test` passes; typecheck and lint clean.
- `LABEL=ratings SHOTS_ONLY=1 timeline.e2e.mjs`: the Trip badge shows 4 for a 4-stop trip.

## Notes for the next person

none
