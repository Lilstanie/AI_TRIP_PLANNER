---
date: 2026-09-22
author: Claude Code (with A)
branch: feature/inter-city-flights
pr: none
area: apps/web, packages/orchestrator, packages/agents, packages/shared
contract-impact: packages/shared
---

# Answer a fare question with a trip open, and show which flight was chosen

## What changed

- `apps/web/app/api/chat/route.ts` — recognise a fare question from the message
  alone; the open plan no longer suppresses it.
- `packages/orchestrator/src/flight-query.ts` — decline edit phrasings
  ("change the flight to …"), which the removed guard used to catch by accident.
- `packages/shared/src/contracts.ts` — `AgentProposal.flights`, mirroring
  `stays` ([note](../notes/implemented/architecture/2026-09-22-flight-selection-contract.md)).
- `packages/agents/src/transport/index.ts` — carry the fares the chosen flight
  beat; `supervisor.ts` publishes them on `agent_completed`.

## Why

Two reports from manual testing, one cause each.

"cheapest flight from Sydney to Tokyo on 25 Nov 2026" planned a nine-day trip.
The route asked `parsed.data.plan ? undefined : parseFlightQuery(...)`, so a
fare question was only ever recognised before the traveller had a trip open —
which is everyone's first question and nobody's second. Recognition belongs to
the message. The plan guard was also silently doing a second job, keeping
"change the flight to X" with the planner, so that intent is now explicit.

Getting around showed a summary line where Stay showed a card. The asymmetry
was in the contract: `AgentProposal` carried `stays`, so `choiceFor` could
publish which hotel was picked and what it beat, but transport's fares were
discarded inside `deterministicPlan` at the moment of choice. Nothing
downstream could render what no longer existed.

## Validation

- `pnpm test` 537/537 (3 new); typecheck, lint, build, `verify:docs`,
  `verify:protected` clean
- Live, with a Sydney trip already open: the same question returns
  `flight_answer`, cheapest Sichuan Airlines A$613 of 10 fares
- Live, Tokyo nine-day plan: `agent_completed.choice` is
  `Flight Sydney → Tokyo`, selected Sichuan Airlines `AUD 4226.00 · 1 stop ·
  19h 45m`, with 9 alternatives

## Notes for the next person

`choiceFor` publishes the first selection only, matching the existing stay
behaviour, so a multi-hop trip shows one flight card. Showing every hop's
choice is a UI change, not a contract one — the data for all of them is there.
