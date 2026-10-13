---
date: 2026-10-10
author: Codex
branch: main
pr: none
area: .agents/notes
contract-impact: none
---

# Refine the proposed local test CLI around the existing runner

## What changed

- Updated [the proposed testing note](../notes/proposed/testing/2026-10-10-local-test-cli.md)
  with confirmed entry-point and production-mode decisions and five small subcommand responsibilities.
- Limited initial support to verified complete local scenarios; specified server, state and evidence
  isolation, explicit unsupported outcomes and failure-preserving serial repeats.
- Kept reports as saved JSON and excluded a new CLI package, report service and parallel scheduler.

## Why

The user asked to incorporate the Ponytail review while retaining the earlier instruction to pause
implementation. Extending the existing runner avoids a second test framework without weakening
isolation or treating skipped assertions as passes.

## Validation

- Scoped `pnpm exec prettier --write`: passed for the proposal.
- `pnpm verify:docs`: passed.
- `pnpm verify:protected`: passed.
- `git diff --check`: passed.

## Notes for the next person

No CLI implementation, commit or push. No runtime/E2E tests were run for this documentation change.
Initial smoke membership, environment isolation mechanism and production startup cost remain to be
verified. The proposal stays proposed; shipped documentation and implemented decisions need no update.
Existing dated session logs and unrelated UI documentation changes were preserved.
