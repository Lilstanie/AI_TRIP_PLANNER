---
date: 2026-10-24
author: Claude (owner-c retro thread)
branch: docs/trip-planner-pr-delivery-skill
pr: none
area: .agents/skills
contract-impact: none
---

# Put the trip-planner-pr-delivery skill in the repository

## What changed

- `.agents/skills/trip-planner-pr-delivery/SKILL.md`: the account skill as saved on 2026-10-24,
  with the Jira reporter and assignee rules, the Jira call shapes, worktree-per-PR, the superseded-head
  check, the batch-PR rule, and the rule to move stories to 完成 by hand after merge.

## Why

Joey asked for the skill to live in the repository (`.agents/`) as well as the account. The account
copy and this copy can drift; whichever one Joey treats as the source must be named in the PR.

## Validation

Recorded in the PR Evidence section.

## Notes for the next person

The account skill still has the same text. If one changes, update the other.
