# Agent Note: Separate collection orchestration from repeated browser journeys

Status: implemented

## Problem

Collections acceptance repeatedly executed the same single-agent and replay browser assertions to
verify different selection and aggregation modes. Changing CLI selection still needs public-process
coverage, but repeated UI work dominates that evidence.

## Decision

The existing collections script retains real production smoke and development replay. The remaining
selection, reporting, unsupported and aggregation cases run the unchanged CLI/router/ownership
modules copied into an isolated fixture, with controlled external server and journey processes.
The original successful-mode assertions remain; child-start events prove executed order and count.
An explicit child-failure control verifies nonzero aggregation and continuation to the next member.

The script saves each invocation, exit status, stdout/stderr, duration and child-start events beneath
`output/e2e/cli-collections/`. Fixture records are orchestration evidence, not browser coverage.
Production CLI, browser journeys and CI selection/scheduling policy are unchanged.

This refines the coverage of the existing
[E2E CLI acceptance](2026-10-11-e2e-performance-acceptance.md); its isolation, ownership and retained
evidence decisions remain in effect.

## Alternatives considered

- Delete named-multiple or all-success checks: loses the corresponding public selection/report contract.
- Reuse a live server between CLI invocations: violates per-invocation resource isolation.
- Add a new test framework or production injection option: unnecessary for a process fixture.

## Consequences

- Two real browser journeys retain UI evidence while orchestration cases avoid repeated app setup.
- The fixture must track the CLI's module imports and process contract; it does not validate Next.js.
- Lower local elapsed time is a measurement for this script, not a guaranteed whole-CI speedup.
