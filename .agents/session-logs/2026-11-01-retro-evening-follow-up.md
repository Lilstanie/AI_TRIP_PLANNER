---
date: 2026-11-01
author: Claude Code for Joey
branch: docs/TP-254-retro-evening-follow-up
pr: none
area: .agents/skills, .gitignore
contract-impact: none
---

# Skill rules from the Stage 2 final-evening retro (TP-254)

## What changed

- `trip-planner-pr-delivery`: Jira key only from `createJiraIssue`; one PR for a thread's mechanical refactors; sync with GitHub's Update branch instead of a local merge and push; wait for CI with `subscribe_pr_activity` or a background `gh pr checks --watch`; Vercel rate-limit red may be ignored when it is the only red item; a "Before a deadline" code-freeze section.
- `pre-push-checks`: clear `*.tsbuildinfo` and read main's CI before reporting main broken.
- `.gitignore`: `packages/*/output/`.

## Why

Retro file `/mnt/project-files/retro/2026-11-01-final-evening-retro.md` (project files, not in the repo); Joey accepted all items. The Vercel rule follows the merge line Joey added to the project instructions the same evening.

## Validation

See the PR Evidence section.

## Notes for the next person

Item F (skip Vercel preview builds) is a separate PR because Lilstanie owns the Vercel project.
