# Agent Note: Revision requests carry a typed kind

Status: implemented
Owner: C (HeadmasterEggy)
Jira: TP-35

## Problem

`isInfeasible` matched the reason text with `startsWith`, and the accommodation and dining agents
detected budget revisions with a regular expression over the reason and constraints. Rewording a
reason would silently change routing.

## Decision

`RevisionRequest` carries `kind`: `budget`, `time`, `geography`, `infeasible`, or `request`. The
planning loop sets it when it detects a conflict: an overrun is `budget`, an unschedulable floor is
`infeasible`, a time overlap is `time`, and a conflict the agent reports on its route is `geography`.
When one agent has several conflicts, the most severe kind wins (`infeasible` > `budget` > `time` >
`geography`). `isInfeasible` reads `kind`. Accommodation and dining read `kind === "budget"`.

A traveller's own message to a specialist has no typed conflict, so it is `request`. Those agents keep
the wording check only for `request`, so "make the hotel cheaper" still starts a budget revision.

`TripPlan.conflicts` parses a missing `kind` as `request`, so plans saved before this change still load
and keep their current keyword routing.

## Alternatives considered

Keeping the regex makes every new conflict reason a silent routing change. Making `kind` required on
saved plans would break loading of stored plans, so the fallback is `request`.

## Consequences

Anything that builds a `RevisionRequest` must set `kind`. The shared contract changed, so this note
accompanies the change, and `contract-impact: packages/shared` is set in the session log.
