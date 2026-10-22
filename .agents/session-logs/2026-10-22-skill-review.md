---
date: 2026-10-22
author: Claude Code
branch: docs/skill-review-2026-10-22
pr: pending
area: docs
contract-impact: none
---

# Fix skill drift checker false positives and clarify gh usage in pre-push-checks

## What changed

- `.agents/skills/skill-maintenance/scripts/check-skills.mjs`: ignore tokens containing `? & = ^`,
  and `origin/` or `upstream/` refs, so the drift report stops calling a gh URL, a sed expression
  and `origin/main` missing paths.
- `.agents/skills/pre-push-checks/SKILL.md`: say the PR-search command needs an authenticated `gh`,
  and name `mcp__github__search_pull_requests` for cloud sessions.

## Why

`check-skills.mjs` flagged `pre-push-checks` as broken with three false positives. The checker
treated a git ref, a URL inside a `gh api` string and a sed expression as file paths.

Reviewed without changes: the account skills (Matt Pocock set matches upstream tag v1.3.1), and the
repo skills `better-layout`, `better-ui`, `better-accessibility`, `agent-experience`, `better-writing`,
`add-provider`, `break`, `translate-docs` and `ui-verification`. Their named tokens, breakpoints,
helpers and paths still exist. Drift commits on `docs/workspace-ui.md` were read by subject, not
line by line.

## Validation

- `node .agents/skills/skill-maintenance/scripts/check-skills.mjs`: `pre-push-checks` no longer
  reports a missing path. 9 of 22 skills still show drift prompts, which are not errors.
- `node --test scripts/skill-rules.test.mjs`: 26 pass, 0 fail.
- `node scripts/verify-docs.mjs`: exit 0, "Agent Notes, skills and Markdown links are valid."
- `node apps/web/tests/cli-e2e/skill-maintenance.e2e.mjs`: 62 CLI cases passed, exit 0.

## Notes for the next person

- `review-checkpoint.json` was not written: the full review of every skill has not been done yet,
  so `is-due` still reports a review due.
- The account skill `trip-planner-pr-delivery` lives outside this repo and is changed separately.
