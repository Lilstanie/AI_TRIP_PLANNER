# AI Trip Planner

A travel workspace where each account keeps its own trips, specialists plan a trip from a brief, and the Agent Lab compares ways of organising that work.

## Planning

**Brief**:
What the traveller asked for: destination, dates, group, budget and preferences.
_Avoid_: request, prompt, query

**Specialist**:
One of the five domain experts (itinerary, transport, accommodation, destination guide, dining), each owning a goal, its own tools and an output the others do not produce.
_Avoid_: agent (for one of the five), capability, sub-agent

**Coordinator**:
The assistant that answers a message that mentions no specialist and dispatches work to the specialists. It is shown beside them in the chat but is not one of the five.
_Avoid_: supervisor, orchestrator (for the assistant the traveller sees), master agent

**Plan**:
The assembled result of a brief: one costed section per specialist.
_Avoid_: itinerary (that is one section), trip (the saved plan in the workspace)

**Planning loop**:
The cycle that dispatches the specialists, checks the plan for conflicts, optionally revises, and assembles the plan.
_Avoid_: pipeline, orchestration loop

**Conflict**:
A problem found between sections of a plan, such as an overrun budget or overlapping times, that names the specialist to revise.
_Avoid_: issue, error

**Targeted revision**:
Asking only the specialist a conflict names to fix it, within the planning loop's round limit.
_Avoid_: repair loop, bounded revision, retry, re-plan

**Round**:
One pass of the planning loop; round 1 is the first dispatch and later rounds are revisions.
_Avoid_: iteration, attempt

**Plan score**:
How far a plan is from usable: the AUD over budget plus a tenth of the budget for each other conflict. Lower is better, and a revision is kept only when it lowers it.
_Avoid_: quality score

## Trip

**Stop**:
A place in the itinerary that is scheduled on a day. Only stops are counted, numbered and drawn on the map.
_Avoid_: activity (in prose), item, point

**Idea**:
A place kept in the itinerary without a day. It is not a stop until the traveller schedules it.
_Avoid_: unscheduled stop, saved place, backlog

**Visit**:
One stop at one place; a place on two days has two visits.
_Avoid_: occurrence, repeat stop

**Stop number**:
The number a place carries across the whole trip, given in visiting order. A place visited again keeps its first number, and the map, the trip list and the timeline all show the same number.
_Avoid_: index, order (in prose), per-day number

**Visiting order**:
The order stops are shown everywhere: by day, then start time, then their order in the plan.
_Avoid_: plan order, sort order

**Alternative**:
A flight or stay the specialist found and priced but did not pick, which the traveller can take instead.
_Avoid_: candidate, option, other choice

**Leg**:
The journey from one stop to the next on the same day, with its own travel mode and time.
_Avoid_: connection, transfer, hop

**Journey**:
Travel between cities: from the departure city to the first destination (the arrival), or from one destination to the next. A trip with no departure city has no arrival.
_Avoid_: leg (that is within one day), transfer, airport run

## Workspace

**Account**:
One signed-in identity whose chats, trips, settings and long-term memory follow it to any device.
_Avoid_: user (in prose), profile, login

**Travel profile**:
The defaults an account fills in by hand in Settings, such as home base, travellers, budget and dietary needs, that prefill every new trip.
_Avoid_: settings (for these fields), preferences, long-term memory

**Long-term memory**:
The lasting preferences the planner learns from what an account says in chat and uses in its later plans; the account can see, delete or switch it off.
_Avoid_: travel profile, history, preferences (alone)

**Notice**:
A short message the workspace itself writes to the traveller, such as an error, a confirmation or a planning progress line, shown in the interface language. Model replies and provider text are not notices and are shown as received.
_Avoid_: toast, alert, error string

**Reply language**:
The language the planner writes in for one turn: the language of the traveller's latest message, or the interface language when the message's language is unclear. Model replies and specialist summaries in that turn share it.
_Avoid_: chat language, model language

## Money

**Planning amount**:
A cost, budget or total in AUD, the one currency specialists plan and check budgets in.
_Avoid_: base amount, raw price

**Display currency**:
The currency the traveller reads a trip's planning amounts in: the last currency they named for that trip, whether with a budget or on its own, otherwise the Settings currency. A converted amount is an approximation and never feeds back into planning.
_Avoid_: local currency, user currency, trip currency

**Source budget**:
The budget exactly as the traveller stated it, in the currency they used, kept beside its planning amount.
_Avoid_: original budget, input budget

**Fare**:
A provider's price in the provider's own currency, shown as evidence and never converted or added to planning amounts.
_Avoid_: provider amount, native price

## Agent Lab

**Agent Lab**:
The public, repeatable page that runs a scenario under different strategies and compares what they produce.
_Avoid_: playground, demo

**Scenario**:
A fixed brief together with the evidence it is planned from.
_Avoid_: test case, example

**Strategy**:
One way of turning a scenario into a plan: a single agent, five specialists without revision, or five specialists with targeted revision.
_Avoid_: mode, variant, approach

**Baseline**:
The single-agent strategy that the others are compared against. A strategy, not a sixth specialist.
_Avoid_: control, sixth specialist

**Run**:
One strategy executed once on one scenario, producing a trace and an artifact.
_Avoid_: execution, attempt

**Trace**:
The ordered events of a run.
_Avoid_: log

**Artifact**:
The versioned record of a finished run: its plan, trace and metrics.
_Avoid_: result, report

**Metric**:
A figure computed from a run's final plan and trace alone, with no model judging it.
_Avoid_: score, grade

**Rating**:
A judgement of a plan against a written rubric, given by people or a model, reported apart from metrics with how many raters gave it and how far they disagreed.
_Avoid_: quality score, metric (for a judged figure)

**Benchmark**:
A versioned set of scenarios run under the same strategies and configuration, so that its metrics can be compared across code versions.
_Avoid_: eval suite, dataset, test set

**Fixture**:
Deterministic stand-in data that makes a run repeat exactly and need no keys.
_Avoid_: mock, stub (in prose)
