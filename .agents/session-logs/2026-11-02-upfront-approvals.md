---
date: 2026-11-02
author: Claude Code for Joey
branch: docs/TP-287-upfront-approvals
pr: none
area: .agents/skills
contract-impact: none
---

# Ask once up front for steps the safety check holds (TP-287)

## What changed

- `trip-planner-pr-delivery` skill: names the steps that stop at the automatic safety check (Jira create, self-merge, deletes on the user's Mac) and tells the thread to ask for them in one sentence in its first reply or card.

## Why

Retro item C (2026-11-02). Three threads each waited 13 to 34 minutes on one of these steps although memory and project instructions already allowed them.

## Validation

See the PR Evidence section.

## Notes for the next person

The Mac half of item C (an allow rule for `node scripts/worktrees.mjs --apply`) lives in Joey's untracked `.claude/settings.local.json`, not in this repo.
