# Agent Note: the traveller chooses how to make a hop

Status: implemented
Owner: A (@Lilstanie)

## Problem

How each hop of a journey is made was entirely the planner's decision. The arrival is flown; a hop
between cities starts on the ground and is promoted to a flight only when the ground journey cannot
fit a planning day ([journey legs](2026-09-22-journey-legs-and-trip-origin.md)). A traveller who
would rather take the train to Sydney, or sit on a night bus to save the fare, had no way to say so
— and `legMode`'s `preference` parameter, added as the seam for exactly this, had zero callers for
ten days.

The seam was also the wrong width. `ModePreference` was `LegMode` (`"flight" | "ground"`), which
cannot express "train, not the bus": train versus bus is a choice *within* ground travel, and
nothing could make it.

## Decision

`TripBrief.legModes?: LegModeChoice[]` — `{ from, to, mode: TravelMode }`, matched to a hop by its
endpoints, case- and whitespace-insensitively, first match winning. Endpoints rather than a leg
index, because an index shifts the moment a destination is added and would silently re-point the
choice at a different hop.

`ModePreference` widens from `LegMode` to `TravelMode`. `legMode` still answers `"flight" | "ground"`
— any non-flight choice is ground — and the specific mode rides along on `JourneyLeg.chosenMode`,
so the transport agent can honour "bus" over "train" when the provider offers both.

A chosen ground mode is **exempt from promotion**. Flying a hop the traveller said to take by train
would override the one thing they stated; if the chosen mode cannot fit a planning day, that is a
conflict to report, not a decision to reverse. A chosen mode the provider does not offer for that
hop is reported too, never silently substituted.

The traveller states it in conversation — "take the train from Melbourne to Sydney" — through the
same coordinator path `excludeFlights` uses, and it appears as a removable chip in the trip
preference list, so it is visible and undoable rather than a hidden setting.

Ways this can fail, written before the code and each handled above: the chosen mode is not among the
hop's options (reported, not substituted); a chosen ground mode cannot fit a planning day (reported,
not promoted to a flight); `flight` chosen while `excludeFlights` is true (the trip-wide statement
wins and the contradiction is stated); a stale choice matching no hop after the destination changed
(ignored, and never matched to a different hop); two choices for one hop (the first wins); endpoints
differing in case or spacing (still matched); a choice aimed at an intra-city activity connection
(out of scope — this governs journey legs only); `walk` chosen for an inter-city hop (the day-fit
rule reports it rather than scheduling a nine-day walk); choosing `flight` costing one SerpApi
search for that hop (one per flown hop, unchanged by replans).

## Alternatives considered

**A per-hop control in the Getting around section, posting to `/api/trip/preview-edit`.** That route
recomputes routes directly through `integrations/google` with no agent round, so it is fast and fits
the existing edit mechanism — but it cannot price a flight, which is the switch that matters most
(Melbourne → Sydney: fly or take the train?). It remains the right home for a control *on top of*
this contract field.

**A trip-wide preference ("prefer cheapest" / "prefer fastest").** Simpler and needs no endpoint
matching, but it cannot answer the actual question, which is per hop: fly the long leg, train the
short one.

**Index the choices by leg position.** Smaller payload, but adding a destination renumbers the hops
and the stored choice would quietly apply to a different journey.

## Consequences

- `legMode`'s seam is now load-bearing, so a future UI control has somewhere to write to.
- A stated choice can make a plan infeasible on purpose. That surfaces as a conflict naming the
  chosen mode, which is the honest outcome: the traveller asked for something that does not fit.
- The budget can get worse when the traveller chooses a slower, unpriced mode — an unpriced leg
  carries no cost ([unpriced leg is not a conflict](../bug-fix/2026-10-02-unpriced-leg-is-not-a-conflict.md)),
  so swapping a priced flight for an unpriced train lowers the known estimate without lowering the
  real one. The summary's unpriced count is what says so.
