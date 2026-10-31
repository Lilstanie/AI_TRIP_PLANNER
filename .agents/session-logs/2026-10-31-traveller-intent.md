---
date: 2026-10-31
author: Claude Code
branch: feature/TP-202-packed-pace
pr: none
area: packages/shared, packages/orchestrator, packages/agents, apps/web
contract-impact: packages/shared
---

# The brief model records the traveller's intent

## What changed

- `packages/shared/src`: `TripIntent` on `TripBrief` and `PartialTripBrief`; `LastingPreference`
  and `ChatResponse.lastingPreferences`.
- `packages/orchestrator`: `update_trip_brief` takes `pace`, `dietary`, `interests`, the stay
  requirements, `tripDays` and `rememberForAccount`. `BriefIntake.update` skips the regexes for a
  model's patch. `mergeBriefPatch` merges intent by field.
- `packages/agents`: the itinerary plans by pace (prompt counts, packed fallback slots, two meals,
  museums for those interests); dining, stays and interest ranking read the intent.
- `apps/web`: the workspace keeps `intent` through every brief and draft conversion; the chat route
  saves lasting preferences.
- Agent Note `feature/2026-10-31-traveller-intent.md`; `docs/architecture(.zh).md`.

## Why

Joey asked why plans had so few stops a day and that the cause be fixed at the source, for every
wording, not only "特种兵". Joey also asked for as few tests as possible.

## Validation

- One new test: `packages/agents/tests/itinerary/packed-pace.test.ts`. The day-count tests in
  `packages/orchestrator/tests/chat.test.ts` now send the model's `tripDays`.
- Failure list: `packages/orchestrator/tests/traveller-intent.failures.md`.

## Limitations

- The flight-query, revision-intent and chat-grounding regexes are unchanged.
