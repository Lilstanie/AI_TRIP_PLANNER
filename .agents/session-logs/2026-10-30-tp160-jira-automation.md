---
date: 2026-10-30
author: Claude
branch: docs/TP-160-jira-automation
pr: 800
area: docs, .agents/skills
contract-impact: none
---

# Make PR delivery move Jira stories every time

## What changed

- `trip-planner-pr-delivery` skill: opening the PR moves the story to 正在进行 and links the PR; merging moves it to 完成 with one `Merged:` comment. Both are now required steps with their done conditions, not optional follow-ups.
- `docs/agents/issue-tracker.md` (+ `.zh.md`): the Status bullet says who moves the story and when.

## Why

Joey chose the skill over Jira Automation rules (2026-10-30): no Jira admin setup and no automation run quota.

## Validation

See PR evidence.

## Notes for the next person

- A teammate who merges without this skill still moves the story by hand.
