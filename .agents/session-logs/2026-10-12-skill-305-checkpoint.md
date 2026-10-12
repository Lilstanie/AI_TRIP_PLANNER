---
date: 2026-10-12
author: Codex
branch: docs/skill-305-refresh
pr: none
area: .agents/skills/skill-maintenance, apps/web/tests/cli-e2e
contract-impact: none
---

# Explicit full-review checkpoints for skill maintenance (#305)

## What changed

- `skill-maintenance/SKILL.md` documents committed coverage and explicit Issue evidence.
- `is-due.mjs` preserves partial-edit activity and reports incomplete Git/GitHub signals.
- `apps/web/tests/cli-e2e/skill-maintenance.e2e.mjs` exercises public subprocesses only.
- Added the [checkpoint decision](../notes/implemented/process/2026-10-12-skill-review-checkpoint.md).

## Why

Existing merge/squash counting, thresholds, flags and drift entrypoints were reused. Helper edits and
bare Issue mentions cannot establish a full review. Rejected proposals are not implemented notes.
No checkpoint was created in this checkout; fixture checkpoints certify only isolated fixtures.

## Validation

- Failure inventory preceded CLI acceptance and logic: `/tmp/skill-305-evidence/failure-inventory.md`.
- Five vertical red/green slices retained in `/tmp/skill-305-evidence/`; initial history-fixture
  evidence collection was corrected before the genuine missing-history red was recorded.
- `node apps/web/tests/cli-e2e/skill-maintenance.e2e.mjs`: 61 public CLI cases passed.
- Final slice evidence: `/tmp/skill-305-evidence/slice-5-green.log`; its printed temporary directory
  retains every subprocess status, stdout/stderr and fixture history in `summary.json`.
- `node scripts/verify-docs.mjs`: passed.
- `node .agents/skills/skill-maintenance/scripts/check-skills.mjs --json`: 22 skills, zero broken.
- `node scripts/verify-branch-name.mjs docs/skill-305-refresh`: passed; `git diff --check`: passed.
- Scoped Prettier write completed using primary-repository binaries; no dependency installation.

## Notes for the next person

Parent owns development EN/ZH, translation records, runner registration and full-review audit. A new
skill requires fresh full coverage. Review summaries and Issue evidence still need human judgment;
format validation cannot establish semantic correctness. Squash/merge PR activity is counted, but a
checkpoint revision removed by a squash must be replaced by an actually reviewed reachable revision.
The curl stub now lives outside fixture Git histories, preserving isolation across orphan checkouts.
No product suites, external writes, pushes, PRs, shared contracts or protected-root edits were made.
