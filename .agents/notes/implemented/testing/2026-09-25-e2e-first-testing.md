# Agent Note: Prefer E2E testing for complex behavior

Status: implemented

## Problem

Guidance across the project pointed contributors toward focused unit and component tests after
implementation, while complex user flows were often checked manually. The repository also needs
reviewable evidence that another person can reproduce.

## Decision

For complex features, prefer E2E as the sole behavioral test and leave a verifiable, repeatable
artifact. Never write unit tests after implementation code. If an isolated check is necessary, first
enumerate the ways the system could fail, then write the code and derive focused checks from that list.
Keep current Vitest and CI checks documented as existing regression checks. The repository currently
has no checked-in automated E2E suite, so this policy does not imply one is already configured.

## Alternatives considered

No other alternatives were recorded for this policy update.

## Consequences

- Complex feature work should validate complete user paths and retain reproducible evidence.
- Isolated checks need a failure inventory written before implementation.
- Existing CI tests remain part of the current repository verification until its setup changes.
- The documentation and skills describe the E2E preference without claiming an E2E suite already runs in CI.

## Sources

- [AGENTS.md](../../../../AGENTS.md)
- [Testing approach session log](../../../session-logs/2026-09-25-testing-guidance-docs.md)
