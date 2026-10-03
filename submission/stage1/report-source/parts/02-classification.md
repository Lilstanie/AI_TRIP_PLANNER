# 2. Requirement classification

## 2.1 Agreement, mandatory capabilities and optional features

**Agreement (scope the group and the stakeholder agreed).** The product is a single-user planning
workspace: describe a trip, inspect grounded recommendations, edit the plan, save it and reopen it.
Prices are estimates in AUD; the system does not book, pay or refund. Multi-user collaboration,
social features, in-app payment and booking fulfilment are out of scope for Stage 2. Models may
reason and choose, but they never decide the control flow, invent a price or place, or override a
confirmed preference; deterministic code checks every model output.

**Mandatory capabilities** (the product is not acceptable without them):

| ID | Capability | Owner |
| --- | --- | --- |
| M1 | Chat intake that extracts a structured trip brief and asks for missing facts | A |
| M2 | LangGraph planning loop: dispatch, conflict detection, targeted revision (at most 3 rounds), build plan | A |
| M3 | Day-by-day itinerary with route-feasibility checks | B |
| M4 | Transport between and within cities, with times and fares | B |
| M5 | Accommodation for individuals or groups within the stay allocation | C |
| M6 | Budget roll-up in AUD, overrun spreading and infeasible-budget detection | C |
| M7 | Grounded destination guide | D |
| M8 | Dining recommendations that respect dietary needs | D |
| M9 | Workspace with timeline and map views and plan editing | E |
| M10 | Preference and session memory | E |
| M11 | Provenance label on every section; deterministic fallback when a model or provider fails | All |

**Optional features** (add value; the product is acceptable without them): Agent Lab and Failure
Lab (A); traveller-chosen leg mode and own flights (B); keep a booked stay (C); weather-based
packing advice (D); accounts and cloud sync (E); attachments in chat; place photos.

## 2.2 Ad hoc requirements (individual)

Informal statements in the stakeholder's own words, before any modelling.

| ID | Member | Ad hoc requirement |
| --- | --- | --- |
| AH-C1 | C (`@HeadmasterEggy`) | "We're five friends going to Tokyo on a fixed budget. I want the planner to work out how many rooms we need, whether we share or each get our own, and pick a hotel I'd actually stay in: decent rating, free cancellation if I asked for it. Flights get paid first, so the hotel has to fit in whatever money is left. If the whole trip ends up over budget, I want the hotel swapped for a cheaper one that still meets my rules rather than being told nothing fits. If no hotel can ever fit, tell me the minimum I'd need instead of making up a cheap one. And if I've already booked somewhere, just keep it." |
| AH-A1 | A | _to be written by A_ |
| AH-B1 | B | _to be written by B_ |
| AH-D1 | D | _to be written by D_ |
| AH-E1 | E | _to be written by E_ |

Group-level needs gathered in early lab discussion (from the team's design doc): clothing advice
from the weather, accommodation for individuals or groups, food recommendations, day-by-day
scheduling, luggage rules, transport, a budget, a chat window that splits a request into tasks and
merges the answers, and filters for party size, area and budget.

## 2.3 Classified requirements: member C

AH-C1 is broken down into classified requirements below. FR = functional, NFR = non-functional,
C = constraint.

| ID | Type | Requirement | Traced to |
| --- | --- | --- | --- |
| R-C1 | FR | Compute the room count from party size and room allocation: `individual` gives one room per guest, `shared` gives ⌈guests / 2⌉. | `accommodation/index.ts` |
| R-C2 | FR | Filter stay candidates by minimum rating and, when requested, free cancellation; these are hard rules that a budget revision may not relax. | `planning.ts: eligibleOptions` |
| R-C3 | FR | Choose the first stay preferring rating ≥ 8 and free cancellation, within the stay allocation left after transport. | `chooseInitial`, board allocation |
| R-C4 | FR | Roll up section costs in AUD and compare the total with `budgetTotal`. | `budget.ts: rollUpCost` |
| R-C5 | FR | On any overrun, spread the required saving over the sections that can still be cut, and send each a targeted revision request. | `conflicts.ts: detectConflicts` |
| R-C6 | FR | When the cheapest options already exceed the budget, report one `infeasible budget` conflict naming the minimum, and stop revising. | `minimumCost`, `INFEASIBLE_BUDGET` |
| R-C7 | FR | Keep a stay the traveller has already booked, unpriced and without a search. | `bookedStayProposal` |
| R-C8 | NFR (accuracy) | Money is summed in integer cents so totals never drift. | `sumMoney`, `stayCost` |
| R-C9 | NFR (integrity) | The model may choose only among searched candidate ids; it never invents a property, rate or policy. | accommodation system prompt |
| R-C10 | NFR (availability) | With no model key, or an off-schema answer, a deterministic fallback still produces a valid proposal. | `planStays` fallback |
| R-C11 | C | At most three revision rounds; a round is kept only if the plan score improves. | `workflow.ts` |


**Classified requirements for members A, B, D and E.** _Each member adds a table in the same
format (FR, NFR, C) for their own ad hoc requirement._

