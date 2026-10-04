# 4. Use cases

## 4.1 Overall use case diagram

![Figure 4.1 Overall use case diagram](img/use-case-diagram.svg)

_Figure 4.1 Overall use case diagram._
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

## 4.2 Use case specifications

One specification per member at least (C wrote two); seven in total. Each comes from that member's ad hoc requirement in §2.2.

### UC-A1 Generate Itinerary

| Field                        | Content                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ID / name**                | UC-A1 Generate Itinerary                                                                                                                                                                                                 |
| **Source**                   | AH-A1; R-A1 … R-A12                                                                                                                                                                                                      |
| **Primary actor**            | Traveler                                                                                                                                                                                                                 |
| **Secondary actors**         | LLM (DeepSeek) as coordinator, supervisor and reply writer; the five specialist agents; Maps / Routes, Hotel / Flight Search and Weather APIs through the specialists                                                    |
| **Goal**                     | A free-text message becomes one validated, internally consistent `TripPlan`, or a plain statement of what is missing or impossible.                                                                                      |
| **Trigger**                  | The traveller sends a chat message to `POST /api/chat`.                                                                                                                                                                  |
| **Preconditions**            | The message is non-empty or carries an attachment. Nothing else is required: facts missing from the brief are what this use case resolves.                                                                               |
| **Postconditions (success)** | A `TripPlan` exists with five sections, each `draft` or `needs_you`, `estTotal` and `overrunPct` computed, and a reply naming what the traveller must still decide. Every costed item came from a specialist's evidence. |
| **Postconditions (partial)** | A `needs_info` or `ask_user` frame is returned with the facts understood so far, and no plan is invented.                                                                                                                |
| **Postconditions (failure)** | An error frame naming the specialist that failed. No partial plan is presented as a plan.                                                                                                                                |

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

- 2a. _No model configured, or off-schema output_: no patch is applied; the turn proceeds on the facts already stated, and the reply is written by `fallbackReplyFor` (R-A11).
- 3a. _A required fact is still missing_ (destination, dates, group size or budget): the turn ends with `IncompleteBriefError` naming the missing fields, carrying `known` so the traveller need not repeat the rest. Nothing is defaulted (R-A2).
- 3b. _Dates are unreal, reversed, or shorter than one night per city_: the brief is rejected with the reason; planning does not start.
- 3c. _The traveller states a lasting wish, a travel mode or a booked stay_: it is recorded on the brief (`learnedPreferences`, `legModes`, `bookedStay`) and the plan is re-run with it.
- 4a. _The traveller asked a question the plan already answers_: the coordinator answers from the plan and does not replan.
- 5a. _The coordinator would rather ask than guess_: it calls `ask_user_question` with 2-4 options in the traveller's language, recommended option first, and the turn ends there; no other tool runs after it (R-A3).
- 5b. _Supervisor unavailable or off-schema_: all five specialists are dispatched deterministically; the itinerary specialist is never skipped (R-A11).
- 6a. _A specialist throws_: the run stops and the error frame names it; no partial plan is returned.
- 7a. _Conflicts remain, a round is left, and none is `infeasible budget`_: `revise_conflicts` re-invokes only the targeted specialists, each with its previous proposal and any `targetSaving`, then returns to step 7 (R-A6).
- 7b. _`planScore` did not improve after a revision_: the round is discarded, the earlier proposals are kept, `stalled` is set and the flow goes to step 8 — a revision can never make the plan worse (R-A7).
- 7c. _Three rounds have run and conflicts remain_: the plan is built with each still-targeted section marked `needs_you` and `conflicts` listing what is unresolved (R-A9).
- 7d. _`infeasible budget`_: the revision loop is skipped entirely and the reply names the minimum budget needed (member C's UC-C2, extension 2b).

**Special requirements**: R-A10 (a model-proposed change is re-validated before it plans anything), R-A11 (every LLM step has a deterministic fallback), R-A12 (the above is replayed under injected faults in `agent-lab`).

### UC-B1 Arrange Transportation

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

**Main success scenario**

1. The traveler supplies origin, destinations, dates, party size, budget and any per-leg mode choice. Chat intake produces a validated brief upstream of this use case.
2. The workflow dispatches `transportAgent.invoke` through its specialist boundary and planning board, with injected tools and memory.
3. Transport validates the dates, derives the ordered journey and reads any relevant origin preference. It gathers offered flight fares and ground routes, plus route alternatives when the port supports them.
4. With a configured model, the Transport LLM calls `search_transport_evidence`, then selects offered flight IDs and a planning day/local departure time for each routed hop. It does not supply prices or durations.
5. Deterministic code resolves selected IDs against the evidence, requires exactly one fare per hop with offered fares, checks required hop coverage, planning-day bounds and HH:mm syntax. It checks route validity and whether each scheduled hop fits within its planning day.
6. Code assembles the proposal from provider prices and durations, applies supported mode preferences, and records assumptions, a cost floor, available flight alternatives and a source label. If an allocation is exceeded, the chosen flights give way to the cheapest returned fares.
7. The workflow validates the proposal schema; the planning board stores it. In the staged first round, itinerary planning can read transport and accommodation proposals when those dependencies were dispatched. It grounds activities, validates its draft and checks connections using route duration plus a 15-minute buffer.
8. Once dispatched proposals are collected, deterministic conflict policy checks known budget totals, reported route problems and scheduled-item overlaps.
9. With no unresolved conflict, the workflow assembles the plan and returns transport as `draft`, together with the known estimate and source information. The traveler can inspect or change it in chat/editor.

**Extensions**

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

### UC-D1 View Weather-based Clothing Recommendation

| Field                        | Content                                                                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID / name**                | UC-D1 View Weather-based Clothing Recommendation                                                                                                                                                          |
| **Source**                   | AH-D1; R-D1–R-D5                                                                                                                                                                                          |
| **Primary actor**            | Traveler                                                                                                                                                                                                  |
| **Secondary actors**         | Orchestrator (system role), Maps / Places API, Weather API (Google Weather API or Open-Meteo), long-term preference store                                                                                 |
| **Goal**                     | The traveller receives destination and weather-based packing guidance plus grounded dining candidates informed by confirmed dietary preferences, with evidence limits made clear.                         |
| **Trigger**                  | The traveller submits a trip request and the Orchestrator dispatches the specialist agents for the valid `TripBrief`.                                                                                     |
| **Preconditions**            | 1. A valid `TripBrief` exists with destination, travel dates, group size and user id. 2. The MapsPort, WeatherPort and memory port are injected; coordinates and saved dietary preferences may be absent. |
| **Postconditions (success)** | Destination-guide and dining `AgentProposal`s are included in the assembled `TripPlan`; attractions and venues match map candidates, and weather horizon/source are stated.                               |
| **Postconditions (partial)** | If coordinates, forecast data or a model are unavailable, the plan still includes available deterministic guidance and labels weather as climate context or unavailable rather than a forecast.           |
| **Postconditions (failure)** | If required map or memory retrieval fails, the affected specialist fails and the workflow reports the specialist failure; it does not invent place evidence.                                              |

**Main success scenario**

1. The traveller submits destination, dates, party size and dietary requirements such as vegetarian food and a peanut allergy.
2. The Orchestrator dispatches Destination Guide and Dining with the validated `TripBrief` and injected maps, weather and memory ports.
3. Destination Guide validates the trip dates, then retrieves sight and museum candidates and saved preferences.
4. It removes duplicate map candidates and uses a candidate coordinate to request weather for the first travel date.
5. The weather adapter selects a forecast or climate source for the date and returns the horizon and provenance with the result.
6. The configured LLM reads the validated brief, month, place candidates and preferences through its read-only evidence tool, then drafts destination and packing guidance.
7. Deterministic code fits the draft to the output schema, rejects ungrounded attraction names and deduplicates accepted candidates; invalid output uses the local fallback.
8. Dining retrieves restaurant candidates and saved preferences, filters to dietary-related preferences and computes a per-person meal ceiling.
9. The configured LLM drafts venue suggestions from its evidence tool. Deterministic code checks the budget and candidate names, while the proposal says menus and allergy suitability must be confirmed with the venue.
10. The Orchestrator validates the proposals at the graph boundary, assembles the `TripPlan` and returns the weather-packing and dining sections to the traveller.

**Extensions**

- 4a. _No candidate has coordinates or no WeatherPort is available_: skip the forecast request and use month-level planning context; do not present it as a forecast.
- 5a. _The trip date is more than 14 days away_: return historical climate context, explicitly not a forecast. In mock mode, the weather fixture follows the same horizon distinction.
- 5b. _Weather provider fails_: continue with month-level context and label the weather provider unavailable; do not fail the destination guide solely because weather failed.
- 7a. _No model is configured, the model fails, or its draft is invalid or names an ungrounded attraction_: return deterministic guidance from available map evidence and mark the proposal as fallback.
- 8a. _No restaurant candidates are returned_: return the meal-budget envelope without venue picks.
- 9a. _No saved dietary preferences exist_: generate general grounded candidates and state that no confirmed dietary preferences were found.
- 9b. _A traveller reports an allergy_: never guarantee a venue is safe; tell the traveller to confirm ingredients and cross-contamination controls directly with the venue.

**Special requirements**: R-D2 (forecast horizon and provenance), R-D4 (grounded names and dietary safety), R-D5 (visible degradation and fallback).

### UC-E1 Edit Itinerary (Timeline / Map)

| Field                                  | Content                                                                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID / name**                          | UC-E1 Edit Itinerary (Timeline / Map)                                                                                                                                 |
| **Source**                             | AH-E1; R-E1–R-E6                                                                                                                                                      |
| **Primary actor**                      | Traveler                                                                                                                                                              |
| **Secondary actors**                   | Web workspace, deterministic itinerary editor, Maps / Routes / Places API, browser local storage; the chat LLM is a separate path and is not invoked by this use case |
| **Goal**                               | Change a scheduled activity while preserving a valid, explainable and current trip plan.                                                                              |
| **Trigger**                            | The traveller selects or drags a stop in the timeline/map, changes its time/place, requests a route check, or chooses undo.                                           |
| **Preconditions**                      | A `TripPlan` is open; it has an itinerary proposal; activities have unique IDs and complete schedule data; the client holds the current `editVersion`.                |
| **Postconditions (success)**           | The validated preview is applied to client state and autosaved in browser storage; routes, conflicts, costs and edit issues are shown.                                |
| **Postconditions (blocked / failure)** | The current client plan remains unchanged and the preview reports an invalid operation, unavailable route, unverified price or stale preview.                         |

**Main success scenario**

1. The traveller selects a stop in the timeline or map, changes its time/place, requests a route check, or chooses undo.
2. The workspace identifies the activity by stable ID and builds a typed `EditRequest`.
3. The workspace sends the plan, `baseVersion`, operation and route mode to `/api/trip/preview-edit`.
4. The deterministic editor parses the request, checks plan identity and rejects a stale `baseVersion`.
5. The editor applies the operation to a copy and checks day, time, ID and destination-segment rules.
6. For affected days, Maps / Routes is queried for travel time between consecutive places.
7. The editor recomputes route blockers, conflicts, section costs, total cost and budget status.
8. A changed place receives a `price_unverified` issue; route verification does not currently clear that price issue.
9. The workspace shows a preview with differences, route results, blockers and budget consequences.
10. The client compares `preview.baseVersion` with the current plan version, then applies the plan to React state and autosaves it to localStorage.

**Extensions**

- _Chat path_: the coordinator may update the trip brief, replan, answer a question, or return the existing plan. It does not create an `EditRequest` for this use case.
- 4a. _Stale plan at preview time_: return "Start from the current plan"; keep the current client plan unchanged.
- 5a. _Move crosses destination accommodation segments_: reject the move because the destination stay would no longer match the itinerary.
- 6a. _End time is not after start time, the day is outside the trip, or IDs are not unique_: return a blocker and do not apply.
- 7a. _A place is missing_: ask the traveller to confirm/search for the place before checking routes.
- 7b. _The route provider fails_: show `route_unavailable`; preserve the preview but do not claim the route is valid.
- 8a. _The edit causes a schedule or budget conflict_: show the conflict and mark the affected section `needs_you`.
- 9a. _A place change affects cost_: show `price_unverified`; the current verify operation rechecks routes but does not implement separate price clearance.
- 11a. _The traveller cancels the preview_: discard the preview and keep the old plan.
- 12a. _Undo is requested_: restore the saved activity snapshot, rerun validation and create another plan version.

**LLM versus deterministic control**

| Concern           | Current LLM / chat behaviour                                                  | Current deterministic responsibility                                                                       |
| ----------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Chat request      | Updates the brief, replans, asks a question or answers; no `EditRequest` tool | N/A for this edit boundary                                                                                 |
| Timeline/map edit | Not invoked                                                                   | Parse and validate `EditRequest`, IDs, dates, times and segments                                           |
| Route and budget  | Not invoked                                                                   | Query providers; compute routes, blockers, conflicts, costs and status                                     |
| Price uncertainty | May explain the result                                                        | Set `price_unverified`; no complete price-clearance operation yet                                          |
| Memory            | Drops learned preferences when the setting is off                             | Long-term memory service stores/reads preferences; specialist read gating is not fully tied to the setting |
| Apply changes     | No direct write access to the edit endpoint                                   | Client version check, React state update and localStorage autosave                                         |

**Special requirements**: R-E4 (deterministic recalculation), R-E6 (stale or malformed previews are rejected without inventing a route, price or place).
