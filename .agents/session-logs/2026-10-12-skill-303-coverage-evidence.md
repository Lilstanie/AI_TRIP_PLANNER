---
date: 2026-10-12
author: Codex
branch: docs/skill-303-refresh
pr: none
area: .agents/skills/find-simplifications, .agents/skills/pre-push-checks
contract-impact: none
---

# Preserve coverage owners and validation evidence for #303

## What changed

- Refreshed both skill entrypoints and find-simplifications project patterns.
- Required removed-assertion owners, equivalent boundaries and repeatable evidence.
- Preserved dedicated faults/offline replay and scenario-local interleavings.
- Added helper/import costs, public/dynamic/persisted contracts and measured-speed limits.
- Documented Next build/typecheck ordering, runtime flags and final-tree evidence reuse.

## Why

Started at integration commit d7cde6a; reused merged f046094 (#291) and current coverage
rather than repeating consolidation. #286/#288/#289 are closed Issues implemented by
#291, not separate PRs. Kept recent CLI CI and scoped comment-gate guidance.

## Validation

- Semantic inspection: #300/#303 JSON (no comments), current scripts/config, #291 and
  #286/#288/#289, implemented coverage and E2E isolation notes; requirements mapped.
- node scripts/verify-docs.mjs: passed, including the new log.
- node .agents/skills/skill-maintenance/scripts/check-skills.mjs find-simplifications --json:
  passed, no missing paths or broken commands.
- Same drift command for pre-push-checks: initial missing generated filename corrected;
  rerun passed with no missing paths or broken commands.
- pnpm --dir /Users/joey/AI_TRIP_PLANNER exec prettier --write with absolute scoped
  skill paths: passed; --check passed on all four changed files.
- git diff --check: passed, including the new log.
- Committed-tree protection guard and integration merge results belong in final handoff.

## Notes for the next person

No new tests or application suites: prose-only scope. Historical #291 test counts are
not current passes. Parent owns development EN/ZH, translation pairs, completed-review
audit, lasting maintenance note and integration. Add the e2e-maintenance link after its
skill exists. No docs pairs or checkpoint were changed here; no global pair pass claimed.
