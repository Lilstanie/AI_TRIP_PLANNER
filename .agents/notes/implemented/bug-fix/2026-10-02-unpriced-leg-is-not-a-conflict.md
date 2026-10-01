# Agent Note: an unpriced leg is a fact, not a conflict

Status: implemented
Owner: A (@Lilstanie)

## Problem

Every ground leg whose fare a provider did not publish raised a conflict: *"Transport fare
unavailable on day N: budget total is incomplete, not a free trip."*

No revision can fix it. The fare is missing because the provider does not publish it — Google
returns no `transitFare` for Australia at all — so the orchestrator spent a revision round on a
request the transport agent could only answer the same way, and the plan still ended with an
unresolved conflict. [Inter-city rail via SerpApi](../feature/2026-09-26-intercity-rail-via-serpapi.md)
measured this on Tokyo → Kyoto: one unresolvable fare conflict, three rounds, nothing resolved. It
fixed the inter-city case by finding a real fare, and deliberately left itinerary hops out of the
quota — so those hops are permanently unpriced by design, and permanently conflicted.

A conflict is the UI's "needs_you" state. Filling it with something the traveller cannot act on
pushes the conflicts that *are* theirs to act on down the list.

## Decision

An unpriced leg carries no `estCost` and raises no conflict. The transport summary states how many
legs are unpriced, and an assumption says the known estimate is therefore a floor. The count is
derived from the items themselves — an item without `estCost` is an unpriced item — so nothing new
is threaded through to say it twice.

Ways this can fail, written before the code and each handled above: every leg unpriced (the summary
says so and the total reads as a floor, not as a free trip); no leg unpriced (no count is added, so
the summary is unchanged); a leg priced at a real `0` (priced, not unpriced — `fareUnavailable`
keys on the provider's note, not on the amount); a fare arriving later for a leg reported unpriced
(the count is recomputed per proposal, never cached).

## Alternatives considered

**Estimate the fare from a published rate table** (Opal caps, distance bands). The budget would be
closer to the truth, but the number would be ours, not a provider's, and this project does not show
invented prices as fares — the same reason the itinerary agent stopped inventing activity prices.

**Keep the conflict but mark it unresolvable.** The orchestrator already stops on an unresolvable
budget conflict, so the machinery exists; but the traveller still reads a conflict they cannot act
on, which is the actual complaint.

## Consequences

- Transport can now return zero conflicts on a plan with unpriced public-transport legs, so a
  revision round is spent only where a revision can change something.
- The budget is understated by exactly the unpriced legs. The summary and `floorCost` say so; a
  reader who wants the fares has to look them up with the operator.
- This governs journey legs only. Intra-city connections (`arriveBy`) never carried a cost.
