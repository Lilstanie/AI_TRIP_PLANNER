---
date: 2026-10-31
author: Claude Code
branch: feature/TP-21-agent-lab-exit-paths
pr: none
area: orchestrator tests, submission, docs
contract-impact: none
---

# Agent Lab record of every planning-loop exit

## What changed

- `packages/orchestrator/tests/agent-lab-exit-paths.e2e.test.ts`: runs one fixture Agent Lab run per
  loop exit (no conflict, resolved, stalled, round limit, infeasible) plus the single-agent baseline on
  the same tight budget, asserts each stop reason, rounds and unresolved conflicts, writes the full
  artifacts to `output/e2e/TP-21/<run>/` and fails when the committed table no longer matches.
- `submission/stage2/agent-lab-exit-paths.md`: the table and what it shows; linked from
  `submission/stage2/README.md` and the Agent Lab section of `docs/architecture.md` and `.zh.md`.

## Why

TP-21 asks for one repeatable artifact per exit path, and the Stage 2 rubric asks for agent
improvement backed by data. On the A$2,300 trip the single agent estimates A$3,960, five specialists
without revision A$2,560 and targeted revision A$2,120.

## Validation

- The new test passed twice with `RUN_ID=repeat1` and `repeat2`; both `summary.json` files are identical.

## Notes for the next person

- `tokyo-couple-infeasible-budget` fails its own must-pass checks `evidence-floor` and
  `infeasibility-reported` in fixture mode (estimate below the A$3,320 floor), so the record uses
  `paris-family-infeasible` for the infeasible path. Not investigated.
- A true three-round limit is not reachable on any fixture scenario; the round-limit row uses the
  one-round no-revision strategy.
