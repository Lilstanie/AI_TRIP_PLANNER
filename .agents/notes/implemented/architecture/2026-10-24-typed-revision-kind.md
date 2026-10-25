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
`geography`). `isInfeasible` reads `kind`. Transport, accommodation and dining share the package-internal
`revisionIntent` function: `budget` activates saving and `time` activates scheduling, regardless of
reason text. Other typed kinds activate neither.

A traveller's own message to a specialist has no typed conflict, so it is `request`. Only that kind
uses the common wording check over reason and constraints. Saving keywords are `budget`, `cost`,
`cheaper`, `overrun`, `cut` and `reduce`; scheduling keywords are `time`, `overlap` and `schedule`.
A request can activate both. The fallback preserves dining's existing saving vocabulary and
transport's scheduling vocabulary. Numeric saving targets do not infer intent; the planning loop
continues to turn them into allocations. All three model requests carry the kind and normalized intent;
a shared prompt rule makes that intent authoritative over prose. See [TP-88](https://headmastereggy.atlassian.net/browse/TP-88).

`TripPlan.conflicts` parses a missing `kind` as `request`, so plans saved before this change still load
and keep their current keyword routing.

## Alternatives considered

Keeping the regex makes every new conflict reason a silent routing change. Making `kind` required on
saved plans would break loading of stored plans, so the fallback is `request`.

## Consequences

Anything that builds a `RevisionRequest` must set `kind`. The original typed-kind change affected the
shared contract. Centralizing its interpretation is internal to `packages/agents` and needs no further
contract change. Allocations, stay eligibility and ranking remain with their existing calculators.
