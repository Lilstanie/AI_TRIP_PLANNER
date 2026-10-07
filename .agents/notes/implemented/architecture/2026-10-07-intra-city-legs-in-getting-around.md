# Agent Note: Getting around covers every movement, including inside a city

Status: implemented
Owner: A (@Lilstanie)

## Problem

Transport was split across two sections of the same plan. Getting around held the flight in and the
hops between cities; the journeys between a day's stops were drawn inside the day plan, as connectors
under the stop they led to. A traveller asking "how do I get around on this trip?" had to read two
places, and neither of them was complete.

## Decision

Getting around shows all three: the arrival, the inter-city hops and the intra-city legs, grouped by
day and ordered by when the traveller arrives. The day plan draws no connectors, so each leg appears
once.

The legs stay connectors. They are **not** turned into items on the transport proposal, which is the
obvious way to do this and the wrong one: an item with a day and a time joins the cross-agent overlap
check in `detectConflicts`, and a squeezed gap would then be reported twice — once as the itinerary's
geography conflict and once as a time overlap naming the same minutes. They also carry no cost, so
adding them as items would invite one.

`dayConnections(sections)` reads them off the day plan's items, and `TripPanel` hands them to the
transport section only.

Ways this can fail, written before the code and each handled: a trip whose transport section has no
items at all, which a single-city trip produces (the section is empty only when it has neither items
nor legs); a stop with no `arriveBy`, because the provider could not route it (skipped, as before);
an activity with no day or no start time (skipped — it cannot be ordered); a leg on a day that has no
transport item (the day group is created for it); the day plan rendered on its own, as the tests do
(no connectors, which is the point).

## Alternatives considered

**Synthesise transport items in the orchestrator.** The plan data would then say what it contains,
rather than the UI joining two sections. Rejected for the duplicate-conflict reason above, and
because the items would need times derived from the activity they lead to, which is exactly what
makes them collide.

**Leave them in the day plan and link across.** No change at all, but it keeps the answer to one
question in two places, which is the complaint.

## Consequences

- The day plan reads as places and times only. Someone scanning it no longer sees how long the hop
  between two stops takes without opening Getting around.
- Getting around can be non-empty while the transport specialist produced nothing, which is correct
  for a single-city trip but means its summary line can disagree with what is listed; the summary
  still counts only the specialist's own items.
