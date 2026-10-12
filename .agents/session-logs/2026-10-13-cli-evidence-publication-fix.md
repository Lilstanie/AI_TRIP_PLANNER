---
date: 2026-10-13
author: Codex
branch: feature/cli-acceptance-integration
pr: 318
area: testing, .github, docs
contract-impact: none
---

# Preserve CLI evidence through artifact publication

## What changed

- Recovered source commit `c0d6acd` after the implementation agent hit its usage limit.
- Worker evidence is archived before upload; original filenames, hidden metadata and bytes remain.
- Failed packaging cannot publish stale or partial archives; worker receipts retain failure semantics.
- Ignore generated `output/cli-evidence/` archives in local checkouts.
- Updated development EN/ZH, its review record, the owning decision and E2E maintenance guidance.

## Why

CI run `38234232288` passed every acceptance step, but GitHub rejected a retained filename with a
line feed. Worker 3 and the aggregate correctly failed. Archive publication preserves that test.

## Validation

- Recovered red/green ledger: external `cli-acceptance-ci/ci-packaging-red-green.md`.
- Inspected final subprocess summary `ci-integration-nF3x9z`: all nine scenarios passed on Node
  26.8.1/macOS, including exact archive extraction and missing/partial/failed publication controls.
- Preserved the complete worker evidence outside its worktree under `evidence/ci-packaging/`.
- The source is unchanged from the recovered commit; this handoff adds only ignore and log records.

## Notes for the next person

Final integrated guards, delta review and fresh-SHA Ubuntu/Node 22 CI remain to be completed.
Keep the failed run and its receipts. Stop before merging PR #318.
