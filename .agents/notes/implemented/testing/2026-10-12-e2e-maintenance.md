# Agent Note: Diagnose E2E checks through reproducible public controls

Status: implemented

## Problem

A successful process can conceal skipped assertions or failed saved results. Hangs and inconsistent
fixtures can also resemble product regressions, and a passing rerun can obscure the original evidence.
The existing CLI decisions describe execution and retention without owning the diagnosis workflow.

## Decision

The [e2e-maintenance skill](../../../skills/e2e-maintenance/SKILL.md) owns diagnosis and repair of
the check itself: failure inventory before isolated implementation, equivalent Git baseline/current
reproduction, successful and deliberate-failure controls, assertion/skip/exit/summary inspection,
environment controls, bounded execution, owned cleanup and retention of every attempt's evidence.

The existing deterministic runner and report fixtures demonstrate these boundaries without new
tests, a new runner, live credentials or a browser build. Their scope is runner/report behavior;
browser and product claims still require the appropriate journey and visible evidence.

Supersession check: this supplements the [local CLI decision](2026-10-10-local-test-cli.md) and
[reliability/performance decision](2026-10-11-e2e-performance-acceptance.md); neither is replaced.
The [E2E preference](2026-09-25-e2e-first-testing.md) still owns test strategy. Review, UI verification
and pre-push skills retain their roles; the new skill links their entrypoints.

## Alternatives considered

- A new runner or test-triage framework: unnecessary because existing public CLI probes already
  exercise successful, failed, timed-out and interrupted outcomes with retained evidence.
- Require a full browser suite for maintenance prose: the deterministic fixtures provide focused
  runner/report evidence without expensive unrelated product execution.

## Consequences

- Maintainers distinguish report-read success from recorded test success and completeness; skipped
  checks, interrupted attempts and earlier failures remain visible after later passes.
- Reproduction records include revisions, commands, non-sensitive assumptions, assertion/skip counts,
  summaries, artifact paths and known-failure source/last-checked details.
- Retention consumes disk and manual diagnosis still requires semantic inspection. Local probe
  success does not establish CI, installed-app, provider or browser coverage.
- Development navigation in both languages and relevant existing skill cross-references must be
  integrated by their owners in the same delivery.

## Sources

- [Parent specification #300](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/300)
- [Ticket #304](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/304)
- [Deterministic runner probe](../../../../apps/web/tests/cli-e2e/legacy-runner.e2e.mjs)
- [Interrupted-report probe](../../../../apps/web/tests/cli-e2e/report-interrupted.e2e.mjs)
