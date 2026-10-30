---
date: 2026-10-30
author: Claude
branch: docs/TP-160-jira-automation
pr: none
area: docs, .agents/skills
contract-impact: none
---

# Move Jira stories with Automation rules instead of by hand

## What changed

- `docs/agents/issue-tracker.md` (+ `.zh.md`): status section now points at two Jira Automation rules, with their trigger, condition and actions.
- `trip-planner-pr-delivery` skill: agents no longer transition stories or post progress comments; after merge they check the status and fall back by hand only when the rule did not fire.

## Why

TP-159 (merged 2026-10-29) still had to be moved to Done by hand, so no rule existed. Jira Automation needs no repo secret and no `.github/**` change, unlike a GitHub Action calling the Jira API.

## Validation

See PR evidence.

## Notes for the next person

- The rules live only in Jira; a project admin creates them from the table in the doc. Assignee is not set by the rules.
