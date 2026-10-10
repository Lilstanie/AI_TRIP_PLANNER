---
date: 2026-10-11
author: Codex
branch: feature/local-test-cli
pr: 306
area: apps/web, docs, agent-notes
contract-impact: none
---

# Simplify the local CLI and close report/discovery review findings

## What changed

- Reused the existing child executor for fixture journeys and production builds.
- Removed forwarding wrappers, unused exports/returns, redundant checks and impossible status handling; runtime code is 44 lines smaller.
- Fixed running-check report completeness and human-readable invalid doctor/list diagnostics with public CLI regressions.
- Updated the implemented testing note, paired CLI documentation and reviewed translation hashes.

## Why

The CLI needs one process lifecycle implementation while keeping isolation, evidence and ownership validation intact. Code review reproduced two misleading output cases before fixing them.

## Validation

- Repeat CLI E2E passed, including interrupted-then-passed aggregation, normal pass and parent interruption.
- Discovery E2E failed before the invalid-option diagnostic fix and passed after it.
- A public report invocation reproduced the running-check completeness bug; the report E2E passed after the fix.
- A dev run with a 1000 ms timeout returned nonzero/124, retained evidence and stopped its owned server.
- `run --all --dev --repeat 2 --json` passed both supported journeys in both attempts.
- Report/cleanup/report checks passed, cleanup was idempotent, and all 48 evidence/log files retained their hashes.
- `verify:docs`, `verify:protected`, `verify:pairs` (26), `verify:e2e-selectors`, module syntax and diff checks passed.
- The legacy runner is byte-for-byte identical to the original entry point on origin/main. No code comments were added.

## Notes for the next person

Evidence: `output/e2e/ponytail-cli/result.json` and adjacent logs. Cleaned all 12 new owned invocations while preserving evidence. Local browser tests ran serially; a production build and full repository regression suite were not repeated locally for this refactor. Final-head CI results are recorded in PR #306. Live-provider and physical-device behavior remain outside this fixture-only scope.
