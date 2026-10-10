---
date: 2026-10-11
author: Codex
branch: feature/local-test-cli-299
pr: none
area: apps/web, docs
contract-impact: none
---

# Add verified local E2E cleanup

## What changed

- Added canonical per-run ownership records and filesystem identities; repeat records link to each child run's summary and owner.
- Added public `cleanup` dispatch with strict IDs, canonical resource derivation, stale/symlink checks, repeat cleanup and retained evidence.
- Added CLI E2E coverage and paired cleanup documentation.

## Why

Cleanup needs evidence independent of the run summary and must preserve other invocations, evidence and user data. Filesystem identity includes device, inode, creation time and type; cleanup never kills processes.

## Validation

- `node apps/web/tests/cli-e2e/local-cleanup.e2e.mjs` — passed; artifacts: `output/e2e/local-cli-cleanup-e2e/`.
- `node apps/web/tests/cli-e2e/local-test-cli-repeat.e2e.mjs` — passed, including repeat interruption.
- `pnpm --filter @trip/web lint` — passed.
- Targeted Prettier check, `pnpm verify:pairs`, `pnpm verify:docs`, `pnpm verify:protected` and `git diff --check` — passed.

## Notes for the next person

Cleanup blocks partial or inconsistent ownership records and retains all reports and evidence. Ownership metadata is a consistency check, not cryptographic authentication. No process PID is recorded or terminated.
