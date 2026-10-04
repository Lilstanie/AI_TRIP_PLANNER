<div class="cover">

# AI Trip Planner: a One-Person AI Travel Agency

## ELEC5620 Model-Based Software Engineering, Stage 1 Report

Requirements documentation, architecture design and system modelling

| Member | Name | SID | GitHub | Area |
| --- | --- | --- | --- | --- |
| A | Ziqi He | 530527086 | `@Lilstanie` | Orchestrator and integration |
| B | Tingsong Jin | 540532755 | `@fonever2` | Itinerary and transport |
| C | Yi Qiao | 550378747 | `@HeadmasterEggy` | Accommodation and budget |
| D | Jiahang Bian | 550066431 | `@jbia0391` | Destination guide and dining |
| E | Weihao Wang | 550414791 | `@WhW0591` | Web workspace and memory |

Group: Mon 10-12 Group 14

Repository: https://github.com/Lilstanie/AI_TRIP_PLANNER

Video: _YouTube link_

</div>

# Contents

1. Project requirements
2. Requirement classification
3. Feature model
4. Use cases
5. Architecture analysis and design
6. Elementary structure: class model
7. Complex structure: object, collaboration and structured class
8. Behaviour models (individual)
9. Relationships between key components and future development
10. Design rationale and discarded choices
11. Change assessment and acceptance
12. Design assumptions
13. Contributions and use of generative AI

# 1. Project requirements

## 1.1 Problem

Planning a trip means visiting many sites: one for flights, one for hotels, a map for routes, blogs
for food and customs, and a spreadsheet to keep the total inside a budget. Each choice constrains
the others. A cheaper flight that lands late cuts the first day short, and an expensive hotel leaves
no money for food. General chatbots can write an itinerary, but they invent prices and opening
hours, and they never check that the parts fit together.

AI Trip Planner is a **one-person AI travel agency**. One human founder runs the agency, and a team
of LLM-based agents does the work a travel agency's staff would do. A traveller describes a trip in
chat. The agents then plan it together on a shared planning board, using real map, hotel, flight and
weather data, and the system checks their proposals against each other and against the budget
before the traveller sees the plan.

## 1.2 Primary users and roles

| Role | Kind | Responsibility |
| --- | --- | --- |
| Traveller | Human, primary user | Describes the trip, sets preferences and filters, reads and edits the plan. |
| Founder / operator | Human | Runs the agency: configures models, data providers and quotas, chooses mock or live data, and uses the Agent Lab to measure and compare the agents before a change ships. |
| AI Travel Coordinator | AI role | Talks to the traveller, turns the conversation into a structured `TripBrief`, asks clarifying questions, and explains the result. |
| AI Planning Supervisor | AI role | Inside the deterministic LangGraph workflow, decides which specialists a planning or revision step needs and what each should focus on. |
| AI Itinerary Planner | AI specialist | Builds the day-by-day schedule and checks that each day's route is feasible. |
| AI Transport Agent | AI specialist | Plans flights, inter-city rail and local routes, with times and fares. |
| AI Accommodation Agent | AI specialist | Finds and compares stays, allocates rooms for individuals or groups, and fits the stay budget. |
| AI Destination Guide | AI specialist | Gives grounded attractions, customs, safety, entry and packing advice, including weather. |
| AI Dining Agent | AI specialist | Recommends grounded venues that respect dietary needs and the meal budget. |
| External services | Systems | Maps and routes (Google, OpenStreetMap), hotel and flight search (SerpApi, Google Places), weather (Google, Open-Meteo), DeepSeek LLM. |

The AI roles are clearly different: each has its own system prompt, inputs, tools, output schema
and revision behaviour, and they collaborate through the planning board rather than one model
answering everything.

## 1.3 Key capabilities and core features

**For the traveller**

- *Conversational trip intake.* The traveller writes in English or Chinese; the coordinator extracts
  only what was said into a `TripBrief` and asks for what is missing instead of guessing.
- *Coordinated multi-agent plan.* Five specialists plan in stages (transport, then accommodation,
  then itinerary and dining), each within its share of the budget left by earlier stages.
- *Conflict detection and targeted revision.* Budget overruns, schedule overlaps and impossible
  routes are detected deterministically and sent back only to the agents involved, for at most
  three rounds.
- *Grounded, labelled data.* Every price and place comes from a tool, and every section says whether
  its data is live, estimated, mock or a fallback.
- *Editable workspace.* The plan appears as a timeline and a map; edits re-check routes, times and
  the budget.
- *Memory.* Preferences and chat history persist, and signed-in travellers sync trips across devices.

**For the founder / operator**

- *Agent Lab.* Runs fixed scenarios through a single-agent baseline, five specialists without
  revision, and five specialists with targeted revision, and compares deterministic metrics.
- *Failure Lab.* Injects registered faults (provider timeout, empty result, invalid output,
  supervisor failure, stalled revision) to show the system degrades safely.
- *Mock or live data per request, and provider quotas,* so the agency can control cost.

## 1.4 Feature ownership: two core and one optional feature per member

| Member | Core feature 1 | Core feature 2 | Optional feature |
| --- | --- | --- | --- |
| A | Conversational brief extraction and clarifying questions | Orchestration: brief validation, supervisor delegation, revision routing and round control | Agent Lab comparison and Failure Lab |
| B | Itinerary scheduling with route feasibility | Transport: flights, inter-city rail and local routes | Traveller-chosen leg mode and own flights |
| C | Accommodation for individuals or groups | Budget management with targeted savings | Keep a stay already booked |
| D | Destination guide: attractions, customs, safety, entry | Dining with dietary constraints | Weather-based packing advice |
| E | Chat workspace with timeline and map editing | Preferences and memory | Accounts and cloud sync |

