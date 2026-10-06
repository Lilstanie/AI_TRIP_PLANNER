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
