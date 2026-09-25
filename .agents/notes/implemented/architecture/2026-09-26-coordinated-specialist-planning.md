# Agent Note: Specialists plan in stages over a shared board

Status: implemented
Owner: A (@Lilstanie)

## Problem

The five specialists did not coordinate; they drafted blind and were reconciled afterwards.
`SpecialistRequest` carried only `brief`, `context` and an optional `revision`, and
`dispatch_specialists` ran every specialist in parallel. As a result:

- Each specialist budgeted from a fixed share of the whole trip budget (itinerary 40%, dining 20%)
  without knowing what flights cost, so a trip with an expensive flight overran by design.
- The itinerary did not know where the hotel was.
- `detectConflicts` sent the same `cut <agent> cost by ~30%` to the two most expensive agents
  whatever the overrun (a 505% overrun still asked for 30%); agents matched it with a regex and took
  their cheapest option, so nothing changed once that option was already selected.
- A revising specialist never saw its previous proposal, and no round kept the best result so far.
- An impossible budget was revised for every remaining round instead of being reported.

Every round saw the same inputs as the last, so more rounds could not help. A live run of the
plan-quality E2E ended Paris 505% over budget and Tokyo 3.9% over after three rounds.

## Decision

LangGraph still owns the loop
([LangGraph owns the planning loop](2026-09-08-langgraph-orchestration.md)); what changed is what
the graph passes between specialists.

- **Contract** (`packages/shared`): `SpecialistRequest` gains optional `board` (the other
  specialists' proposals), `allocation` (`{ budget, basis }` in AUD) and `previous` (its own last
  proposal). `RevisionRequest` gains optional `targetSaving`; `AgentProposal` gains optional
  `floorCost`, the lowest total the specialist could reach from the options it found.
- **Staged dispatch** (`packages/orchestrator/src/board.ts`): accommodation waits for transport;
  itinerary and dining wait for both. A call waits only for specialists already started in the same
  supervisor turn, so an uncalled specialist cannot deadlock the others. The same board serves the
  supervisor and the deterministic path.
- **Allocation**: accommodation, itinerary and dining split the budget left after the stages they
  waited for by 0.4, 0.4 and 0.2. Accommodation and transport replace a choice over their allocation
  with the best option within it, or the cheapest; itinerary validates its draft against it; dining
  uses it as its ceiling.
- **Quantified revision** (`conflicts.ts`): an overrun is spread in AUD over each section's cost
  less its `floorCost`. When the floors already exceed the budget, one `infeasible budget` conflict
  names the minimum and the graph stops revising.
- **Best-so-far** (`workflow.ts`): a revision round is kept only if `planScore` improves; otherwise
  the previous proposals stand and the loop stops (`stalled`).

## Alternatives considered

**More rounds or richer revision text only.** Rejected: without the board every round sees the same
inputs, and blind budget shares still overrun whenever transport is expensive.

**Fully sequential dispatch of all five.** Rejected: destination guide and dining do not constrain
each other, so serialising them only adds latency.

**Let the specialists negotiate through model messages.** Rejected for now: it moves control flow
into model output, which the LangGraph note forbids, and makes the loop hard to test.

## Consequences

- Live E2E, three runs per scenario: Tokyo and Bali end within budget with no unresolved conflicts
  in round 1 in 6 of 6 runs; Paris stops in round 1 with one `infeasible budget` conflict in 3 of 3.
  Median planning time fell from 40–60 s to about 28 s, because rounds 2 and 3 no longer run.
- Waiting costs latency inside round 1: itinerary and dining start only after the flight and stay
  searches.
- Activity costs remain model estimates. With no priced evidence the itinerary often reports AUD 0,
  which understates the total; the E2E lists these as warnings.
- The minimum-budget figure reflects the cheapest options the providers returned, not every fare.
- Flight items carry a day but no arrival time, so the itinerary cannot yet start day 1 after
  landing.
- Tests that locked the old semantics (two most expensive agents, 30% cuts, running to K) were
  rewritten for AUD targets, round-1 convergence and the infeasible stop.

## Sources

- Live plan-quality E2E runs of 2026-09-25 (artifacts under `output/e2e/plan-quality/`, not
  committed).
- [PR 73](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/73): route and itinerary fixes that
  exposed this problem.
- [Session log](../../../session-logs/2026-09-26-coordinated-specialist-planning.md).
