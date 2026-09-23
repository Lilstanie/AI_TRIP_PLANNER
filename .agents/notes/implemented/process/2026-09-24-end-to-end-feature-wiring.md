# Agent Note: End-to-end feature wiring

Status: implemented

## Problem

Reviewing all 59 PR descriptions and the 52 session logs that preceded this note showed a recurring failure pattern across the project: behavior or data existed in one layer but was lost, discarded or never connected before reaching its consumer. Examples range from #10 (specialist drafts rejected because prompt and validation rules did not line up), #14 (a frontend decision card had no connected execution path), #20 and #41 (the no-model parser dropped user-provided destination data), #27 (specialist output was discarded), #30 and #34 (fallback/provenance status did not reliably reach the traveller), and #42–#43 (origin input and route options were not wired to their consumers), through the repeated port-wrapper omissions in #53 and #55, discarded route details in #56, and question state missing from memory in #59. These gaps were found during feature work and manual testing, after useful pieces had already been built.

## Decision

Keep [the end-to-end-feature-wiring skill](../../../skills/end-to-end-feature-wiring/SKILL.md) for implementation work that crosses package or runtime boundaries. The full-history review confirms this is a recurring project-wide workflow, not a pattern limited to the recent transport and chat PRs. The skill directs the agent to trace behavior from its source through wrappers, contracts, state and UI to its final consumer, and to cover boundary and exceptional paths with focused checks. It complements `code-review`, which focuses on reviewing a diff and the defect classes already known to this repository.

## Alternatives considered

**Add only another item to `code-review`.** Rejected: the history shows the gaps were discovered during implementation and manual acceptance, not only during review; review-only guidance would miss inspecting the full path while building it.

**Keep the pattern only in session logs.** Rejected: session logs record individual work and are not loaded as the workflow guide for future cross-boundary changes.

**Create a generic integration checklist.** Rejected: the actionable failures here concern values and behavior being dropped at a boundary, including wrappers, consumers and state paths; the skill stays focused on tracing that path.

## Consequences

- Cross-boundary features have a reusable implementation workflow grounded in this repository's recent failures.
- The skill should be updated when its boundary guidance or referenced workflows change; it does not replace the focused provider, UI verification, code review, or session-log skills.

## Sources

- Representative PRs: [#10](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/10), [#14](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/14), [#20](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/20), [#27](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/27), [#30](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/30), [#34](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/34), [#41](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/41), [#42](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/42), [#43](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/43), [#53](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/53), [#55](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/55), [#56](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/56), and [#59](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/59)
- [P1 workspace session log](../../../session-logs/2026-09-16-ui-p1.md), [flight search session log](../../../session-logs/2026-09-22-claude-flight-search.md), [trip origin session log](../../../session-logs/2026-09-22-claude-trip-origin-and-legs.md), [ground transport session log](../../../session-logs/2026-09-22-ground-transport-options.md), [city connections session log](../../../session-logs/2026-09-22-city-connections.md), and [question persistence session log](../../../session-logs/2026-09-23-remember-the-question.md)
