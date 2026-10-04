# 2. Use cases

English | [中文](02-use-cases.zh.md)

## 2.1 Overall use case diagram

The group diagram is [`../diagrams/use-case-diagram.svg`](../diagrams/use-case-diagram.svg).
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

## 2.2 Use case specifications: member C

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

## 2.3 Use case specifications: member A

### UC-A1 Generate Itinerary

| Field | Content |
| --- | --- |
| **ID / name** | UC-A1 Generate Itinerary |
| **Source** | AH-A1; R-A1 … R-A12 |
| **Primary actor** | Traveler |
| **Secondary actors** | LLM (DeepSeek) as coordinator, supervisor and reply writer; the five specialist agents; Maps / Routes, Hotel / Flight Search and Weather APIs through the specialists |
| **Goal** | A free-text message becomes one validated, internally consistent `TripPlan`, or a plain statement of what is missing or impossible. |
| **Trigger** | The traveller sends a chat message to `POST /api/chat`. |
| **Preconditions** | The message is non-empty or carries an attachment. Nothing else is required: facts missing from the brief are what this use case resolves. |
| **Postconditions (success)** | A `TripPlan` exists with five sections, each `draft` or `needs_you`, `estTotal` and `overrunPct` computed, and a reply naming what the traveller must still decide. Every costed item came from a specialist's evidence. |
| **Postconditions (partial)** | A `needs_info` or `ask_user` frame is returned with the facts understood so far, and no plan is invented. |
| **Postconditions (failure)** | An error frame naming the specialist that failed. No partial plan is presented as a plan. |

**Main success scenario**

1. Coordinator merges the message onto the facts earlier turns stated (`known`).
2. The LLM reads the merged context and calls `update_trip_brief` with only the facts this message states.
3. Coordinator validates the patch through `BriefPatchSchema`, applies it with `applyBriefPatch`, and parses the result as a `TripBrief`; the dates must be real and ordered, with at least one night per city.
4. Coordinator starts the LangGraph workflow with the validated brief.
5. `dispatch_specialists` asks the supervisor which specialists to call; the supervisor writes one concrete objective per specialist, naming the trip facts it must respect.
6. Each specialist plans its own section and posts an `AgentProposal` on the staged planning board; one progress event per specialist reaches the browser as it works.
7. `detect_conflicts` rolls up the costs and collects every proposal's conflicts (member C's `detectConflicts`).
8. No conflicts remain: `build_plan` assembles the plan, marking each section `draft`.
9. Coordinator builds a digest of the plan, the LLM writes the reply from it, and the final frame carries both reply and plan.

**Extensions**

- 2a. *No model configured, or off-schema output*: no patch is applied; the turn proceeds on the facts already stated, and the reply is written by `fallbackReplyFor` (R-A11).
- 3a. *A required fact is still missing* (destination, dates, group size or budget): the turn ends with `IncompleteBriefError` naming the missing fields, carrying `known` so the traveller need not repeat the rest. Nothing is defaulted (R-A2).
- 3b. *Dates are unreal, reversed, or shorter than one night per city*: the brief is rejected with the reason; planning does not start.
- 3c. *The traveller states a lasting wish, a travel mode or a booked stay*: it is recorded on the brief (`learnedPreferences`, `legModes`, `bookedStay`) and the plan is re-run with it.
- 4a. *The traveller asked a question the plan already answers*: the coordinator answers from the plan and does not replan.
- 5a. *The coordinator would rather ask than guess*: it calls `ask_user_question` with 2-4 options in the traveller's language, recommended option first, and the turn ends there; no other tool runs after it (R-A3).
- 5b. *Supervisor unavailable or off-schema*: all five specialists are dispatched deterministically; the itinerary specialist is never skipped (R-A11).
- 6a. *A specialist throws*: the run stops and the error frame names it; no partial plan is returned.
- 7a. *Conflicts remain, a round is left, and none is `infeasible budget`*: `revise_conflicts` re-invokes only the targeted specialists, each with its previous proposal and any `targetSaving`, then returns to step 7 (R-A6).
- 7b. *`planScore` did not improve after a revision*: the round is discarded, the earlier proposals are kept, `stalled` is set and the flow goes to step 8 — a revision can never make the plan worse (R-A7).
- 7c. *Three rounds have run and conflicts remain*: the plan is built with each still-targeted section marked `needs_you` and `conflicts` listing what is unresolved (R-A9).
- 7d. *`infeasible budget`*: the revision loop is skipped entirely and the reply names the minimum budget needed (member C's UC-C2, extension 2b).

**Special requirements**: R-A10 (a model-proposed change is re-validated before it plans anything), R-A11 (every LLM step has a deterministic fallback), R-A12 (the above is replayed under injected faults in `agent-lab`).

## 2.4 Template for the other members

Copy this for at least one use case each; the group needs 5–10 in total.

| Field | Content |
| --- | --- |
| **ID / name** | |
| **Source** | your AH-x and R-x ids |
| **Primary actor** | |
| **Secondary actors** | |
| **Goal** | |
| **Trigger** | |
| **Preconditions** | |
| **Postconditions (success / failure)** | |

**Main success scenario**: numbered steps.

**Extensions**: `<step><letter>. <condition>: <steps>`.

**Special requirements**: the NFRs that apply.

Suggested use cases from the existing diagram: A, Generate Itinerary; B, Arrange Transportation;
D, View Weather-based Clothing Recommendation; E, Edit Itinerary (Timeline / Map).
