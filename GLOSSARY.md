# AI Trip Planner

A single-user travel workspace where specialists plan a trip from a brief, and the Agent Lab compares ways of organising that work.

## Planning

**Brief**:
What the traveller asked for: destination, dates, group, budget and preferences.
_Avoid_: request, prompt, query

**Specialist**:
One of the five domain experts (itinerary, transport, accommodation, destination guide, dining), each owning a goal, its own tools and an output the others do not produce.
_Avoid_: agent (for one of the five), capability, sub-agent

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

## Workspace

**Notice**:
A short message the workspace itself writes to the traveller, such as an error or a confirmation, shown in the interface language. Model replies and provider text are not notices and are shown as received.
_Avoid_: toast, alert, error string

## Money

**Planning amount**:
A cost, budget or total in AUD, the one currency specialists plan and check budgets in.
_Avoid_: base amount, raw price

**Display currency**:
The currency the traveller reads planning amounts in; a converted amount is an approximation and never feeds back into planning.
_Avoid_: local currency, user currency

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

**Fixture**:
Deterministic stand-in data that makes a run repeat exactly and need no keys.
_Avoid_: mock, stub (in prose)
