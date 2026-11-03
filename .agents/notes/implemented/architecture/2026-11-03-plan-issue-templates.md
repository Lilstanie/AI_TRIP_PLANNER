# Agent Note: plan issues are written and translated from one template table

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

Conflict reasons and revision constraints are English sentences built in five files
(`packages/orchestrator/src/planning/conflicts.ts`, `packages/agents/src/itinerary/travel.ts`,
`itinerary/index.ts`, `itinerary/revision.ts`, `transport/index.ts`). Specialists and the
coordinator read them in English, but the Think trace shows them to the traveller. To show them in
Chinese, TP-329 and TP-332 added two separate regex tables, one in `apps/web/lib/chat/constraint-copy.ts`
and one in `packages/orchestrator/src/planning/progress-copy.ts`, each copying sentences written
elsewhere. A new or reworded sentence silently fell back to English, and the two tables could drift.

## Decision

- `packages/shared/src/plan-issues.ts` holds one table of plan issues. Each entry has the English
  writer, the pattern that reads it back and the Chinese writer. Producers call
  `planIssue(kind, params)` instead of writing the sentence; the English text, and so every prompt and
  existing test, is unchanged.
- `planIssueCopy(text, language, agentName)` rewrites one issue, or several joined with "; ", in the
  reader's language; English and unknown text (such as model-written conflicts) pass through. The
  orchestrator progress copy and the web constraint copy both call it, with their own role names.
- The wire format stays a string (`AgentProposal.conflictsWith`, `RevisionRequest.reason` and
  `constraints`, progress events); no contract field changes.

## Alternatives considered

- Structured issue objects on `RevisionRequest` and the progress events: the web could then format
  them directly, but the change would reach the planner prompts, Agent Lab scoring and every saved
  trace, while the visible result is the same.
- Keep the two regex tables: a reworded producer sentence would still go unnoticed.

## Consequences

`packages/shared/tests/plan-issues.test.ts` has one sample per issue kind, typed as a record over
`PlanIssueKind`, so a new kind cannot be added without a sample, and checks that each sample and all of
them joined read back as Chinese. A producer that writes an issue sentence by hand instead of calling
`planIssue` is not caught.

## Sources

- TP-329, TP-332 (Chinese constraints and reasons), TP-337; PR #941.
