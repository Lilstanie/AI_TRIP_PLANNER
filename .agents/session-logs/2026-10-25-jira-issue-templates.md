---
date: 2026-10-25
author: Claude Opus 5.5 (project thread)
branch: docs/TP-84-jira-issue-templates
pr: none
area: .github, docs/agents
contract-impact: none
---

# Jira-shaped issue templates

## What changed

- `.github/ISSUE_TEMPLATE/bug.yml`, `idea.yml`, `ui-improvement.yml`: each form gains a required
  **User goal** ("As a … I want … so that …") and **Acceptance criteria**, the two parts of a Jira story,
  and an optional **Jira key** field that the maintainer fills at triage.
- `docs/agents/issue-tracker.md` and its zh pair: describe the new fields. They now say that GitHub issues
  are not synced to Jira, and that no Automation rule moves stories on merge yet.

## Why

Joey asked on 2026-10-25 for the issue templates to follow the Jira format ("可以把 issue 的模板改过来"),
which approves this `.github` change. Merging #687 and #689 showed that TP-79 and TP-80 stayed in To Do,
so the doc's claim about an Automation rule was wrong.

## Validation

- Every form parses as YAML and keeps unique ids.
- `pnpm verify:docs`, `verify:pairs` and `verify:protected` pass, and Prettier passes.

## Docs and Agent Notes

`docs/agents/issue-tracker.md` and its zh pair. No Agent Note. The pinned brief #338 is updated on GitHub.
