# 2. Use cases

English | [中文](02-use-cases.zh.md)

## 2.1 Overall use case diagram

The group diagram is [`../diagrams/use-case-diagram.svg`](../diagrams/use-case-diagram.svg).
Actors: **Traveler** (primary), and three external systems: **Maps / Routes API** (Google,
OpenStreetMap), **Hotel / Flight Search** (SerpApi, Google Places) and **Weather API** (Google,
Open-Meteo).

| Use case                                   | Owner | Relationships                                                          |
| ------------------------------------------ | ----- | ---------------------------------------------------------------------- |
| Set Preferences (Filter)                   | E     | —                                                                      |
| Submit Requirement (Chat)                  | E     | —                                                                      |
| Generate Itinerary                         | A     | «include» Arrange Transportation, Arrange Accommodation, Manage Budget |
| Edit Itinerary (Timeline / Map)            | E     | «extend» Generate Itinerary [traveller edits the plan]                 |
| Arrange Transportation                     | B     | «include» Maps / Routes API                                            |
| Arrange Accommodation (Individual / Group) | C     | «include» Hotel / Flight Search                                        |
| Manage Budget                              | C     | «extend» Edit Itinerary [re-check route and budget]                    |
| View Weather-based Clothing Recommendation | D     | «include» Weather API                                                  |
| View Food / Cuisine Recommendation         | D     | —                                                                      |
| View Itinerary Output                      | E     | «alternative» Timeline / Map                                           |

## 2.2 Use case specifications: member C

### UC-C1 Arrange Accommodation

| Field                        | Content                                                                                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID / name**                | UC-C1 Arrange Accommodation (Individual / Group)                                                                                                                                                    |
| **Source**                   | AH-C1; R-C1, R-C2, R-C3, R-C7, R-C9, R-C10                                                                                                                                                          |
| **Primary actor**            | Traveler                                                                                                                                                                                            |
| **Secondary actors**         | Hotel / Flight Search (SerpApi Google Hotels, Google Places), Orchestrator (system role)                                                                                                            |
| **Goal**                     | Every night of the trip has a stay that respects the traveller's room and quality rules and fits the money left after transport.                                                                    |
| **Trigger**                  | The Orchestrator's `dispatch_specialists` node delegates to the Accommodation agent once Transport has finished on the planning board.                                                              |
| **Preconditions**            | 1. A valid `TripBrief` exists (destination, dates with at least one night per city, `groupSize` ≥ 1, `budgetTotal`). 2. Transport's proposal is on the board, so a stay allocation can be computed. |
| **Postconditions (success)** | An `AgentProposal` for `accommodation` is on the board with one `StaySelection` per city, its cost, a `floorCost` (cheapest eligible total) and a provenance label.                                 |
| **Postconditions (failure)** | No proposal; the run stops with the accommodation specialist named as the failure. No stay is invented.                                                                                             |

**Main success scenario**

1. Orchestrator invokes the Accommodation agent with the brief, the board and a stay allocation (40% of the budget left after transport).
2. Agent reads the traveller's lodging preferences: room allocation, minimum rating, free cancellation.
3. Agent computes the room count: one per guest for _individual_, ⌈guests / 2⌉ for _shared_.
4. Agent splits the trip into stay segments per city, using the inter-city hops Transport scheduled.
5. For each segment, agent searches the booking port for stays in that city and dates.
6. Agent removes malformed and preference-incompatible candidates and sorts the rest cheapest first.
7. The model chooses one candidate id per segment, weighing rating, cancellation and total cost against the allocation.
8. Agent validates the choice against the candidate list and prices it as rooms × nights × nightly rate, in cents.
9. Agent records the cheapest eligible total as `floorCost` and returns the proposal to the board.
10. Orchestrator includes the accommodation section in conflict detection (UC-C2).

**Extensions**

- 2a. _Traveller has already booked a stay_ (`bookedStay` set): agent returns that stay unpriced with `floorCost` 0 and skips steps 3–9.
- 4a. _Transport scheduled no usable hops_: nights are split evenly across cities, extra nights to earlier cities.
- 5a. _Live search unavailable_: Google Places estimates are used and the proposal is labelled "estimated", naming the provider that failed.
- 6a. _No candidate survives the filters_: the agent raises an error and the run stops; it does not relax a confirmed preference.
- 7a. _No model configured, or the model returns an unknown id or off-schema output_: the deterministic rule picks the cheapest candidate with rating ≥ 8 and free cancellation (or the cheapest) within the allocation, labelled "Local fallback".
- 7b. _First choice exceeds the allocation_: the best stay within it is taken, or the cheapest if none fit, and the proposal says why.
- _Any step_. _Revision request received_ (from UC-C2): see UC-C2 step 6.

**Special requirements**: R-C8 (cent arithmetic), R-C9 (no invented properties), R-C10 (fallback).

### UC-C2 Manage Budget

| Field                        | Content                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **ID / name**                | UC-C2 Manage Budget                                                                                                                    |
| **Source**                   | AH-C1; R-C4, R-C5, R-C6, R-C11                                                                                                         |
| **Primary actor**            | Traveler                                                                                                                               |
| **Secondary actors**         | Orchestrator, the five specialist agents                                                                                               |
| **Goal**                     | The plan the traveller receives fits the budget, or says plainly by how much it cannot.                                                |
| **Trigger**                  | All dispatched specialists have put a proposal on the board (`detect_conflicts`), or the traveller edits the plan.                     |
| **Preconditions**            | `budgetTotal` ≥ AUD 0.01; at least one proposal exists.                                                                                |
| **Postconditions (success)** | `TripPlan.estTotal` ≤ `budgetTotal`; no budget conflict remains.                                                                       |
| **Postconditions (partial)** | The plan is returned with the best total found; each section still targeted is marked `needs_you`, and `conflicts` lists what remains. |

**Main success scenario**

1. Orchestrator rolls up every proposal's item costs in AUD cents and computes `overrunPct`.
2. Total is within budget: no budget conflict is raised.
3. Orchestrator builds the plan, marks each section `draft` and returns it with `estTotal` and `overrunPct`.

**Extensions**

- 2a. _Total over budget, but the sum of floor costs fits_:
  1. Orchestrator computes each section's room to cut (its cost less its `floorCost`).
  2. It spreads the overrun over those sections in proportion, creating one `RevisionRequest` per section with a `targetSaving`.
  3. Orchestrator runs `revise_conflicts` for those agents only, giving each its previous proposal and a new allocation (last cost less saving).
  4. Accommodation, on a budget revision, keeps the confirmed preferences and picks the cheapest eligible stay within the new allocation.
  5. Orchestrator re-runs detection and computes the plan score (AUD over budget + 10% of budget per other conflict).
  6. Score improved: keep the round and go back to step 1 of the main scenario. Score not improved: discard the round and go to 2c.
- 2b. _Sum of floor costs already exceeds the budget_: Orchestrator raises one `infeasible budget` conflict naming the minimum, stops revising, and the reply tells the traveller to raise the budget to at least that amount or change dates, origin or destination.
- 2c. _Three rounds reached, or no improvement_: the best plan so far is returned; sections still targeted are `needs_you`.
- _Traveller edits the plan_: costs are re-checked in the editor and a `price_unverified` issue is shown for any unpriced change.

**Special requirements**: R-C8; overrun percentages are compared unrounded.

## 2.3 Template for the other members

Copy this for at least one use case each; the group needs 5–10 in total.

| Field                                  | Content               |
| -------------------------------------- | --------------------- |
| **ID / name**                          |                       |
| **Source**                             | your AH-x and R-x ids |
| **Primary actor**                      |                       |
| **Secondary actors**                   |                       |
| **Goal**                               |                       |
| **Trigger**                            |                       |
| **Preconditions**                      |                       |
| **Postconditions (success / failure)** |                       |

**Main success scenario**: numbered steps.

**Extensions**: `<step><letter>. <condition>: <steps>`.

**Special requirements**: the NFRs that apply.

Suggested use cases from the existing diagram: A, Generate Itinerary; B, Arrange Transportation;
D, View Weather-based Clothing Recommendation; E, Edit Itinerary (Timeline / Map).

## 2.4 UC-B1 Arrange Transportation

| Field                        | Content                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID / name                    | UC-B1 Arrange Transportation                                                                                                                                                                                                                                                                                         |
| Source                       | AH-B1; R-B1–R-B6                                                                                                                                                                                                                                                                                                     |
| Primary actor                | Traveler                                                                                                                                                                                                                                                                                                             |
| Secondary external actors    | Flight search provider; Maps / Routes providers; model service when configured                                                                                                                                                                                                                                       |
| Internal collaborating roles | Workflow / supervisor, Transport specialist, planning board, Itinerary specialist, conflict policy. These are internal system roles, not additional human actors.                                                                                                                                                    |
| Goal                         | Obtain evidence-based transport recommendations coordinated with the daily itinerary, with known prices and any unresolved availability, timing or budget problems made explicit.                                                                                                                                    |
| Trigger                      | The traveler requests a trip plan or a transport-related change; the workflow dispatches Transport, or routes a targeted revision to it.                                                                                                                                                                             |
| Preconditions                | A schema-valid TripBrief exists with valid ordered ISO dates, destination, positive group size and budget. Maps, Booking and Memory ports are injected. A usable model is optional. Normal scenario supplies an explicit origin.                                                                                     |
| Success postconditions       | A schema-valid transport proposal contains provider-based fare choices and scheduled ground legs, is available to downstream planning, and is incorporated into TripPlan. No unresolved request targets transport. Relevant activities have been checked against route evidence. No booking or payment is performed. |
| Partial postconditions       | The best retained proposal preserves known prices, unpriced warnings, unavailable choices and/or conflicts. Transport is `needs_you` only while an unresolved request targets it; otherwise `draft`, including when a ground fare is unknown.                                                                        |
| Failure postconditions       | Invalid input, cancellation or an unrecoverable error stops the run; no successful plan is claimed. Invalid model output alone normally falls back rather than failing.                                                                                                                                              |

### Main success scenario

1. The traveler supplies origin, destinations, dates, party size, budget and any per-leg mode choice. Chat intake produces a validated brief upstream of this use case.
2. The workflow dispatches `transportAgent.invoke` through its specialist boundary and planning board, with injected tools and memory.
3. Transport validates the dates, derives the ordered journey and reads any relevant origin preference. It gathers offered flight fares and ground routes, plus route alternatives when the port supports them.
4. With a configured model, the Transport LLM calls `search_transport_evidence`, then selects offered flight IDs and a planning day/local departure time for each routed hop. It does not supply prices or durations.
5. Deterministic code resolves selected IDs against the evidence, requires exactly one fare per hop with offered fares, checks required hop coverage, planning-day bounds and HH:mm syntax. It checks route validity and whether each scheduled hop fits within its planning day.
6. Code assembles the proposal from provider prices and durations, applies supported mode preferences, and records assumptions, a cost floor, available flight alternatives and a source label. If an allocation is exceeded, the chosen flights give way to the cheapest returned fares.
7. The workflow validates the proposal schema; the planning board stores it. In the staged first round, itinerary planning can read transport and accommodation proposals when those dependencies were dispatched. It grounds activities, validates its draft and checks connections using route duration plus a 15-minute buffer.
8. Once dispatched proposals are collected, deterministic conflict policy checks known budget totals, reported route problems and scheduled-item overlaps.
9. With no unresolved conflict, the workflow assembles the plan and returns transport as `draft`, together with the known estimate and source information. The traveler can inspect or change it in chat/editor.

### Extensions

- **1a — Invalid input:** schema/date validation rejects an invalid brief or unordered dates. Correct the input; do not claim a valid plan.
- **3a — Origin omitted:** current resolution is brief origin, then `transport.origin` memory, then Sydney. The proposal discloses the resolved origin; this fallback is not a user-confirmation step.
- **3b — Traveler arranges flights:** `excludeFlights` skips flight searches/pricing and does not raise a missing-fare conflict for those self-arranged flights.
- **3c — Required flight unavailable or empty:** retain a missing-flight conflict and an incomplete estimate; never fabricate a fallback fare.
- **3d — No usable ground route or route cannot fit:** omit the invalid scheduled hop and record a geography/time conflict. For an unchosen, overlong inter-city ground hop, evidence gathering may first seek a flight instead; an explicit ground-mode choice is not silently overridden for this reason.
- **4a/5a — Model absent, fails or returns an invalid selection:** use a deterministic plan from gathered evidence (gather it if needed). Model-error fallback is labelled `Local fallback`; the no-model path uses normal evidence provenance. Fallback cannot create missing provider evidence.
- **6a — Ground fare unavailable:** omit `estCost`, count the unpriced leg and describe the known estimate as a lower bound. This alone does not trigger a conflict or a revision.
- **6b — Chosen ground mode unavailable:** retain the provider's route and explicitly state the requested mode was unavailable. This alone is a warning, not a revision request.
- **8a — Feasible conflict:** invoke only the targeted revisable specialist(s), passing previous proposals, revision constraints and an allocation where applicable. Repeat evidence gathering, selection and validation. Activity overlaps target itinerary so it moves around transport rather than forcing both to move. Keep a round only if `planScore` strictly improves, then recheck.
- **8b — Infeasible budget:** stop revision and report the evidence-based minimum. The conflict targets the largest-cost section; transport is not necessarily that section.
- **8c — Default third round reached or score does not improve:** return the best retained plan; mark only still-targeted sections `needs_you`. A non-improving round is discarded.
- **Any step — Cancellation/unrecoverable failure:** stop, report the failure and allow a later retry. A future chat/edit starts a new interaction; there is no `confirmed` or `booked` state in this use case.

**Special requirements:** R-B4–R-B6. Trip dates use the current end-exclusive planning interval. Transport estimates are in AUD and are not reservations. Ground-provider durations are gathered before model scheduling; changing the chosen departure time does not automatically re-query time-sensitive transit schedules. Availability gaps must remain visible; `draft` is not a guarantee of complete pricing.
