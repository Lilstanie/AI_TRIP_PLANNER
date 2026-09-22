# Agent Note: a flown hop carries the fares it beat

Status: implemented
Owner: A (@Lilstanie)

## Problem

`AgentProposal` carried `stays`, so the transcript could show which hotel a specialist picked and
what it beat. Transport makes the same kind of choice — one fare out of many for a hop — but the
alternatives were discarded inside `deterministicPlan` where the choice was made. Nothing
downstream could see them, so `choiceFor` had only a stay branch and **Getting around rendered a
summary line where Stay rendered a card with its alternatives**. The asymmetry was in the contract,
not in the UI.

## Decision

`AgentProposal.flights?: FlightSelection[]` mirrors `stays`. A `FlightSelection` names the hop
(`from`, `to`, `depart`, `day`, `passengers`), the chosen `selectedId` and every `FlightCandidate`
the provider returned. The transport agent fills it from the evidence it already gathered, and
`choiceFor` publishes a transport choice on `agent_completed` exactly as it does for a stay.

Optional, so every plan stored before this field still parses, and absent rather than empty when no
fare came back — "no fares" is the `unavailable` source, not a choice with nothing in it.

## Alternatives considered

**Build the card from `items`.** The chosen carrier and price are already there, so a card could be
rendered with no contract change — but the alternatives are not, so it would show a choice with
nothing to compare against, which is the part the traveller asks about.

**Reuse `stays`.** A stay has nights, rooms and cancellation; a fare has stops and duration.
Forcing one shape over both would make every consumer test which kind it was holding.

## Consequences

- Any consumer of `AgentProposal` may now receive `flights`; it is optional and additive.
- A multi-hop trip produces one selection per flown hop. `choiceFor` publishes the first, matching
  the existing stay behaviour; showing every hop's choice is a UI change, not a contract one.
- The candidate list is as long as the provider's answer, which for a live SerpApi search is
  commonly ten or more fares. Consumers that render all of them should paginate.
