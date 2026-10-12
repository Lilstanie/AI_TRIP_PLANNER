---
date: 2026-10-12
author: Codex
branch: docs/skill-304-refresh
pr: none
area: .agents/skills/e2e-maintenance, .agents/notes
contract-impact: none
---

# Add reproducible E2E maintenance guidance for #304

## What changed

- Added `e2e-maintenance/SKILL.md` and its deterministic-controls reference.
- Added the testing decision `2026-10-12-e2e-maintenance.md`; existing CLI decisions remain owners.
- Reused merged #306/#308 runner/report probes; added no runner, tests or product changes.

## Why

Require evidence that checks ran and can fail, compare equivalent revisions, and preserve failures,
partial evidence and unrelated resources. Parent owns development navigation and existing skills.

## Validation

- Baseline clean `d7cde6a`; current tree differs only by this ticket's prose; Node v26.8.1, pnpm 9.15.0.
- `node apps/web/tests/cli-e2e/legacy-runner.e2e.mjs`: baseline/current exit 0; 8/8 named checks each.
- `node apps/web/tests/cli-e2e/report-interrupted.e2e.mjs`: baseline/current exit 0; 7/7 named checks each.
- No failed/skipped named checks; individual assertion-call counts unavailable. No browser runs.
- Timeout/survivor and resistant children exit 1, EACCES exits 2, pass controls exit 0; SIGKILL retained.
- Failed/interrupted reports retain outcomes; interruptions remain incomplete after later passes.
- `git diff --exit-code d7cde6a -- apps/web/tests/e2e apps/web/tests/cli-e2e`: exit 0.
- `node scripts/verify-docs.mjs`: passed notes, skills and links.
- `node scripts/verify-protected-files.mjs d7cde6a`: passed on workflow commit a8a7689.
- `node .agents/skills/skill-maintenance/scripts/check-skills.mjs e2e-maintenance --json`: no missing paths/broken commands.
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs`: 26 pairs passed.
- `pnpm --dir /Users/joey/AI_TRIP_PLANNER exec prettier --write` / `--check` on scoped Markdown: passed.
- `git diff --cached --check`: passed.

## Evidence and integration

- Captures: `output/e2e/skill-304-maintenance/{baseline,current}-{runner,report}.log`.
- Runner baseline/current: `output/e2e/legacy-runner-acceptance/{1791779901922-7369,1791780046534-14587}/summary.json`.
- Report baseline/current: `output/e2e/report-interrupted-acceptance/{report-interrupted-1791779915162-7747,report-interrupted-1791780062750-15013}/summary.json`.
- Raw summaries, fixture events and nonempty report evidence survive under these ignored output trees.
- Parent must add EN/ZH development navigation, record reviewed pairs and cross-reference existing skills.
- No full-review checkpoint advanced. Local probe evidence establishes runner/report behavior only.
- Preserve ignored evidence before worktree cleanup; it does not travel with the commits.
