# 4. Use cases

## 4.1 Overall use case diagram

![Figure 4.1 Overall use case diagram](img/use-case-diagram.svg)

*Figure 4.1 Overall use case diagram.*
Actors: **Traveler** (primary), and three external systems: **Maps / Routes API** (Google,
OpenStreetMap), **Hotel / Flight Search** (SerpApi, Google Places) and **Weather API** (Google,
Open-Meteo).

| Use case | Owner | Relationships |
| --- | --- | --- |
| Set Preferences (Filter) | E | — |
| Submit Requirement (Chat) | E | — |
| Generate Itinerary | A | «include» Arrange Transportation, Arrange Accommodation, Manage Budget |
| Edit Itinerary (Timeline / Map) | E | «extend» Generate Itinerary [traveller edits the plan] |
| Arrange Transportation | B | «include» Maps / Routes API |
| Arrange Accommodation (Individual / Group) | C | «include» Hotel / Flight Search |
| Manage Budget | C | «extend» Edit Itinerary [re-check route and budget] |
| View Weather-based Clothing Recommendation | D | «include» Weather API |
| View Food / Cuisine Recommendation | D | — |
| View Itinerary Output | E | «alternative» Timeline / Map |

## 4.2 Use case specifications: member C

### UC-C1 Arrange Accommodation

| Field | Content |
| --- | --- |
| **ID / name** | UC-C1 Arrange Accommodation (Individual / Group) |
| **Source** | AH-C1; R-C1, R-C2, R-C3, R-C7, R-C9, R-C10 |
| **Primary actor** | Traveler |
| **Secondary actors** | Hotel / Flight Search (SerpApi Google Hotels, Google Places), Orchestrator (system role) |
| **Goal** | Every night of the trip has a stay that respects the traveller's room and quality rules and fits the money left after transport. |
| **Trigger** | The Orchestrator's `dispatch_specialists` node delegates to the Accommodation agent once Transport has finished on the planning board. |
| **Preconditions** | 1. A valid `TripBrief` exists (destination, dates with at least one night per city, `groupSize` ≥ 1, `budgetTotal`). 2. Transport's proposal is on the board, so a stay allocation can be computed. |
| **Postconditions (success)** | An `AgentProposal` for `accommodation` is on the board with one `StaySelection` per city, its cost, a `floorCost` (cheapest eligible total) and a provenance label. |
| **Postconditions (failure)** | No proposal; the run stops with the accommodation specialist named as the failure. No stay is invented. |

**Main success scenario**

1. Orchestrator invokes the Accommodation agent with the brief, the board and a stay allocation (40% of the budget left after transport).
2. Agent reads the traveller's lodging preferences: room allocation, minimum rating, free cancellation.
3. Agent computes the room count: one per guest for *individual*, ⌈guests / 2⌉ for *shared*.
4. Agent splits the trip into stay segments per city, using the inter-city hops Transport scheduled.
5. For each segment, agent searches the booking port for stays in that city and dates.
6. Agent removes malformed and preference-incompatible candidates and sorts the rest cheapest first.
7. The model chooses one candidate id per segment, weighing rating, cancellation and total cost against the allocation.
8. Agent validates the choice against the candidate list and prices it as rooms × nights × nightly rate, in cents.
9. Agent records the cheapest eligible total as `floorCost` and returns the proposal to the board.
10. Orchestrator includes the accommodation section in conflict detection (UC-C2).

**Extensions**

- 2a. *Traveller has already booked a stay* (`bookedStay` set): agent returns that stay unpriced with `floorCost` 0 and skips steps 3–9.
- 4a. *Transport scheduled no usable hops*: nights are split evenly across cities, extra nights to earlier cities.
- 5a. *Live search unavailable*: Google Places estimates are used and the proposal is labelled "estimated", naming the provider that failed.
- 6a. *No candidate survives the filters*: the agent raises an error and the run stops; it does not relax a confirmed preference.
- 7a. *No model configured, or the model returns an unknown id or off-schema output*: the deterministic rule picks the cheapest candidate with rating ≥ 8 and free cancellation (or the cheapest) within the allocation, labelled "Local fallback".
- 7b. *First choice exceeds the allocation*: the best stay within it is taken, or the cheapest if none fit, and the proposal says why.
- *Any step*. *Revision request received* (from UC-C2): see UC-C2 step 6.

**Special requirements**: R-C8 (cent arithmetic), R-C9 (no invented properties), R-C10 (fallback).

### UC-C2 Manage Budget

| Field | Content |
| --- | --- |
| **ID / name** | UC-C2 Manage Budget |
| **Source** | AH-C1; R-C4, R-C5, R-C6, R-C11 |
| **Primary actor** | Traveler |
| **Secondary actors** | Orchestrator, the five specialist agents |
| **Goal** | The plan the traveller receives fits the budget, or says plainly by how much it cannot. |
| **Trigger** | All dispatched specialists have put a proposal on the board (`detect_conflicts`), or the traveller edits the plan. |
| **Preconditions** | `budgetTotal` ≥ AUD 0.01; at least one proposal exists. |
| **Postconditions (success)** | `TripPlan.estTotal` ≤ `budgetTotal`; no budget conflict remains. |
| **Postconditions (partial)** | The plan is returned with the best total found; each section still targeted is marked `needs_you`, and `conflicts` lists what remains. |

**Main success scenario**

1. Orchestrator rolls up every proposal's item costs in AUD cents and computes `overrunPct`.
2. Total is within budget: no budget conflict is raised.
3. Orchestrator builds the plan, marks each section `draft` and returns it with `estTotal` and `overrunPct`.

**Extensions**

- 2a. *Total over budget, but the sum of floor costs fits*:
  1. Orchestrator computes each section's room to cut (its cost less its `floorCost`).
  2. It spreads the overrun over those sections in proportion, creating one `RevisionRequest` per section with a `targetSaving`.
  3. Orchestrator runs `revise_conflicts` for those agents only, giving each its previous proposal and a new allocation (last cost less saving).
  4. Accommodation, on a budget revision, keeps the confirmed preferences and picks the cheapest eligible stay within the new allocation.
  5. Orchestrator re-runs detection and computes the plan score (AUD over budget + 10% of budget per other conflict).
  6. Score improved: keep the round and go back to step 1 of the main scenario. Score not improved: discard the round and go to 2c.
- 2b. *Sum of floor costs already exceeds the budget*: Orchestrator raises one `infeasible budget` conflict naming the minimum, stops revising, and the reply tells the traveller to raise the budget to at least that amount or change dates, origin or destination.
- 2c. *Three rounds reached, or no improvement*: the best plan so far is returned; sections still targeted are `needs_you`.
- *Traveller edits the plan*: costs are re-checked in the editor and a `price_unverified` issue is shown for any unpriced change.

**Special requirements**: R-C8; overrun percentages are compared unrounded.

## 4.3 Use case specifications: members A, B, D and E

_Each member adds at least one specification in the format of UC-C1 (the group needs 5 to 10 in
total). Suggested: A, Generate Itinerary; B, Arrange Transportation; D, View Weather-based Clothing
Recommendation; E, Edit Itinerary (Timeline / Map)._
