# Agent Note: Reduce unused repository surfaces while preserving coverage

Status: proposed

## Problem

The [repository audit](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/279) identified unused exports, obsolete UI rules and repeated test setup. Removing these independently risks losing regression coverage or reviving a superseded architectural decision.

## Proposal

Implement the scoped candidates in issues #280–#289 and validate their combined result in #290. Remove code only after checking callers and dynamic use. Keep observable behavior, failure boundaries and the existing E2E entry points. Share test setup only where it reduces total maintenance cost; leave scenario-specific orchestration local.

## Alternatives considered

- Keep all candidates: preserves behavior but retains documented obsolete surfaces and duplicate setup.
- Consolidate broad modules or replace the testing framework: increases scope and obscures whether existing regressions remain covered.

## Acceptance criteria

- Each removed surface has caller evidence; each removed assertion has a remaining coverage owner.
- Existing browser journeys and specialist fault checks retain repeatable artifacts.
- Documentation describes the resulting behavior and any evidence limitations.

## Risks

Dynamic selectors and historical provider decisions require explicit review. Browser evidence does not establish physical Android device behavior. Candidates that increase total complexity should remain with a recorded reason.
